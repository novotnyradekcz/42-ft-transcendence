// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved.

//! Boots the server: builds the shared state, then mounts the routes.
//!
//! The route table below is also the security boundary, and where a service sits
//! in it is the whole of its access control. Registration, token refresh, the
//! health probe, both WebSocket scopes and the OAuth flow are mounted *outside*
//! `SecurityTransform` — each for a reason noted at the line — and everything in
//! the final `scope("")` requires a valid JWT. Moving a service between those two
//! groups is what decides whether it needs authentication, so it is not a
//! cosmetic edit.

mod authenticator;
mod discussions;
mod games;
mod mails;
mod model;
mod router;
mod schema;
mod session;
mod status;
mod users;
mod websocket;
mod oauth;

use crate::authenticator::{create_authenticator, create_authorizer, init_user_store};
use crate::games::{play_game_ws, Lobby};
use crate::model::users::get_all_users_from_db;
use crate::model::DatabaseInitializer;
use crate::router::*;
use crate::session::load_valid_blacklisted_tokens;
use crate::status::{status_ws, StatusRegistry};
use model::database_initializer::{initialize_db, OAuthConfig};

use actix_governor::{Governor, GovernorConfigBuilder};
use actix_security::http::security::middleware::SecurityTransform;
use actix_security::http::security::Argon2PasswordEncoder;
use actix_security::prelude::{JwtAuthenticator, JwtConfig, JwtTokenService, User};
use actix_session::{storage::CookieSessionStore, SessionMiddleware};
use actix_web::web::Data;
use actix_web::{cookie, web, App, HttpServer};
use std::collections::HashSet;
use std::sync::{Arc, Mutex, RwLock};

// shared by every handler. the mutexes are the reason handlers keep their
// critical sections short and never hold one across an `.await`
#[allow(dead_code)]
struct AppState {
    database: Mutex<DatabaseInitializer>,
    lobby: Mutex<Lobby>,
    status: Mutex<StatusRegistry>,
    encoder: Argon2PasswordEncoder,
    jwt_authenticator: JwtAuthenticator,
    jwt_token_service: JwtTokenService,
    /// In-memory blacklist of invalidated token JTIs (or raw tokens when jti is absent).
    token_blacklist: RwLock<HashSet<String>>,
    oauth: OAuthConfig,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("debug"));

    let mut db = initialize_db();
    let lobby = Lobby::new();
    let encoder = Argon2PasswordEncoder::new();
    let dbusers = get_all_users_from_db(&mut db).expect("Users from DB failed.");
    // the in-memory user store starts as a copy of the table, carrying the same
    // Argon2 hashes, so the two can't disagree about a password
    let users: Vec<User> = dbusers
        .iter()
        .map(|user| {
            User::with_encoded_password(user.name.as_str(), user.password.clone())
                .roles(&["USER".into()])
        })
        .collect();
    // 10 minute access tokens, 1 day refresh. short access tokens are what make
    // the blacklist affordable — a revoked one is only carried until it expires
    let jwt_config = JwtConfig::new(&db.server_environment.get_jwt_hash())
        .issuer("fttranscendence")
        .audience("api-users")
        .expiration_secs(10 * 60);
    let jwt_token_service = JwtTokenService::new(jwt_config.clone()).refresh_expiration_days(1);
    let jwt_authenticator = JwtAuthenticator::new(jwt_config);
    // Load non-expired blacklisted tokens from the database so the in-memory
    // set is consistent with the DB after a restart.
    let token_blacklist = RwLock::new(load_valid_blacklisted_tokens(&mut db));
    // signs the OAuth state cookie. not Key::generate() — a new key each boot
    // kills every in-flight login. needs >= 64 bytes
    let secret_key = cookie::Key::from(db.server_environment.get_pass_hash().as_bytes());
    let state = Arc::new(AppState {
        database: Mutex::new(db),
        lobby: Mutex::new(lobby),
        status: Mutex::new(StatusRegistry::new()),
        encoder,
        jwt_authenticator,
        jwt_token_service,
        token_blacklist,
        oauth: OAuthConfig::from_env(),
    });
    let governor_conf = GovernorConfigBuilder::default()
        .key_extractor(XForwardedForKeyExtractor) 
        .requests_per_second(1)
        .burst_size(5)
        .finish()
        .unwrap();

    init_user_store(users);

    HttpServer::new(move || {
        App::new()
            .wrap(Governor::new(&governor_conf))
            .app_data(Data::new(state.clone()))
            // Public: registration must be reachable without credentials.
            .service(create_user)
            // Also public, and for the same shape of reason: a client refreshes
            // precisely because its access token expired, so requiring one here
            // would make the endpoint unreachable exactly when it is needed.
            // The refresh token in the body is the credential, and the handler
            // validates and revocation-checks it before minting anything.
            // (`#[permit_all]` is documentation only — it expands to the
            // unchanged function. Sitting outside the scope below is what
            // actually keeps SecurityTransform off this route.)
            .service(refresh_token)
            // WebSocket scopes sit outside SecurityTransform: a browser cannot set an
            // Authorization header on a WS handshake, so the middleware would redirect
            // them. Both handlers authenticate themselves via the auth subprotocol.
            .service(web::scope("/games/play").service(play_game_ws))
            .service(web::scope("/status").service(status_ws))
            // liveness probe for the healthcheck. outside SecurityTransform so
            // it answers without a header, and before scope("") swallows it
            .service(health)
            // the one place that still needs a cookie: `state` has to be tied
            // to the browser that started the flow, and a logged-out user has
            // no Authorization header. scoped to /auth; the rest stays JWT
            .service(
                web::scope("/auth")
                    .wrap(
                        SessionMiddleware::builder(
                            CookieSessionStore::default(),
                            secret_key.clone(),
                        )
                        .cookie_secure(true)
                        .build(),
                    )
                    // literal routes first, or /{provider} eats them
                    .service(crate::oauth::oauth_providers)
                    .service(crate::oauth::oauth_session)
                    .service(crate::oauth::oauth_callback)
                    .service(crate::oauth::oauth_start),
            )
            // Everything else is authenticated. SessionMiddleware/CookieSessionStore
            // intentionally dropped: this branch is stateless JWT.
            .service(
                web::scope("")
                    .wrap(
                        SecurityTransform::new()
                            .config_authenticator(create_authenticator)
                            .config_authorizer(create_authorizer),
                    )
                    .route("/", web::get().to(index))
                    .service(
                        web::scope("/users")
                            .service(login_user)
                            .service(get_user)
                            .service(logout)
                            .service(show_users)
                            .service(user_detail)
                            .service(update_user_profile)
                            .service(add_friend)
                            .service(remove_exfriend),
                    )
                    .service(
                        web::scope("/games")
                            .service(show_games)
                            .service(game_detail)
                            .service(create_game)
                            .service(get_game_history)
                            .service(get_leaderboard),
                    )
                    .service(
                        web::scope("/discussions")
                            .service(show_discussions)
                            .service(discussion_detail)
                            .service(create_discussion)
                            .service(create_discussion_post),
                    )
                    .service(
                        web::scope("/mail")
                            .service(show_mail)
                            .service(mail_detail)
                            .service(create_mail),
                    ),
            )
    })
    .bind(("0.0.0.0", 8080))?
    .run()
    .await
}
