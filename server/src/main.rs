// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved.

mod authenticator;
mod discussions;
mod games;
mod mails;
mod model;
mod router;
mod schema;
mod session;
mod users;

use crate::authenticator::{
    create_authenticator, create_authorizer, init_user_store, register_user,
};
use crate::games::{play_game_ws, Lobby};
use crate::model::users::get_all_users_from_db;
use crate::model::DatabaseInitializer;
use crate::router::*;
use crate::session::load_valid_blacklisted_tokens;
use model::database_initializer::inittialize_db;
//{index, show_users, login_user, user_detail, create_user, show_games, game_detail, show_discussions, discussion_detail, create_discussion, create_discussion_post, show_mail, mail_detail, create_mail};

use actix_security::http::security::middleware::SecurityTransform;
use actix_security::http::security::{Argon2PasswordEncoder, SessionFixationStrategy};
use actix_security::prelude::{JwtAuthenticator, JwtConfig, JwtTokenService, SessionConfig, User};
use actix_web::web::Data;
use actix_web::{cookie, web, App, HttpServer};
use std::collections::HashSet;
use std::sync::{Arc, Mutex, RwLock};

#[allow(dead_code)]
struct AppState {
    database: Mutex<DatabaseInitializer>,
    lobby: Lobby,
    encoder: Argon2PasswordEncoder,
    session_config: SessionConfig,
    jwt_authenticator: JwtAuthenticator,
    jwt_token_service: JwtTokenService,
    /// In-memory blacklist of invalidated token JTIs (or raw tokens when jti is absent).
    token_blacklist: RwLock<HashSet<String>>,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("debug"));

    let mut db = inittialize_db();
    let lobby = Lobby::new();
    let encoder = Argon2PasswordEncoder::new();
    let dbusers = get_all_users_from_db(&mut db).expect("Users from DB failed.");
    let users: Vec<User> = dbusers
        .iter()
        .map(|user| {
            User::with_encoded_password(user.name.as_str(), user.password.clone())
                .roles(&["USER".into()])
        })
        .collect();
    let jwt_config = JwtConfig::new(&db.server_environment.get_jwt_hash())
        .issuer("fttranscendence")
        .audience("api-users")
        .expiration_secs(10 * 60);
    let jwt_token_service = JwtTokenService::new(jwt_config.clone()).refresh_expiration_days(1);
    let jwt_authenticator = JwtAuthenticator::new(jwt_config);
    let session_config = SessionConfig::new()
        .user_key("user")
        .fixation_strategy(SessionFixationStrategy::MigrateSession);
    // Load non-expired blacklisted tokens from the database so the in-memory
    // set is consistent with the DB after a restart.
    let token_blacklist = RwLock::new(load_valid_blacklisted_tokens(&mut db));
    let state = Arc::new(AppState {
        database: Mutex::new(db),
        lobby,
        encoder,
        session_config,
        jwt_authenticator,
        jwt_token_service,
        token_blacklist,
    });

    init_user_store(users);

    HttpServer::new(move || {
        App::new()
            .app_data(Data::new(state.clone()))
            .service(create_user)
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
                    .service(user_detail),
            )
            .service(
                web::scope("/games")
                    .service(show_games)
                    .service(game_detail)
                    .service(play_game_ws),
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
            )
    })
    .bind(("0.0.0.0", 8080))?
    .run()
    .await
}
