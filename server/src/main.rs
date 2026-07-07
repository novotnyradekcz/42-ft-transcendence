// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved.

mod model;
mod router;
mod schema;
mod users;
mod games;
mod authenticator;
mod discussions;
mod mails;


// create_authenticator / create_authorizer are only referenced by the disabled SecurityTransform wrap.
use crate::authenticator::init_user_store;
use crate::model::users::get_all_users_from_db;
use crate::router::{index, login_user, update_profile, list_friends, add_friend, remove_friend, show_users, user_detail, create_user, show_games, game_detail, create_game, show_discussions, discussion_detail, create_discussion, create_discussion_post, show_mail, mail_detail, create_mail};

use actix_web::{web, App, HttpServer, cookie};
use actix_security::http::security::{Argon2PasswordEncoder, PasswordEncoder, SessionFixationStrategy};
// Kept commented out alongside the disabled SecurityTransform wrap below; re-enable together.
// use actix_security::http::security::middleware::SecurityTransform;
use actix_security::prelude::{JwtAuthenticator, JwtTokenService, SessionConfig, User};
use actix_session::{storage::CookieSessionStore, SessionMiddleware};
use actix_web::web::Data;
use model::database_initializer::inittialize_db;
use std::sync::{Arc, Mutex};
use crate::games::Lobby;
use crate::model::DatabaseInitializer;

struct AppState {
    database: Mutex<DatabaseInitializer>,
    lobby: Lobby,
    encoder: Argon2PasswordEncoder,
    session_config: SessionConfig,
    jwt_authenticator: Option<JwtAuthenticator>,
    jwt_token_service: Option<JwtTokenService>,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("debug"));
    let mut db = inittialize_db();
    let lobby = Lobby::new();
    let encoder = Argon2PasswordEncoder::new();
    let dbusers = get_all_users_from_db(&mut db).expect("Users from DB failed.");
    let users: Vec<User> = dbusers.iter().map(|user| {
        //TODO change later to plain password_hash from database, where passwords will be already encoded
        User::with_encoded_password(user.name.as_str(), user.password.clone()).roles(&["USER".into()])
    }).collect();

    let session_config = SessionConfig::new().user_key("user").fixation_strategy(SessionFixationStrategy::MigrateSession);
    let state = Arc::new(AppState {
        database: Mutex::new(db),
        lobby,
        encoder,
        session_config,
        jwt_authenticator: None,
        jwt_token_service: None,
    });

    init_user_store(users);

    HttpServer::new(move || {

        App::new()
            .app_data(Data::new(state.clone()))
            // Register the password encoder separately so create_user / login_user
            // can extract it as web::Data<Argon2PasswordEncoder>.
            .app_data(Data::new(state.encoder.clone()))
            // Session cookies dropped: the SPA uses stateless login (verify creds,
            // return the user; no cookie/token), so there is no SessionMiddleware.
            // SecurityTransform is disabled for now: with `http_basic()` its authorizer
            // returns 401 for every request that carries no HTTP Basic credentials, and
            // the browser SPA never sends any — so every frontend call (users, discussions,
            // mail, and the /games/play/ws websocket) would be rejected. Re-enable once the
            // auth layer understands browser requests.
            // .wrap(
            //     SecurityTransform::new()
            //         .config_authenticator(create_authenticator)
            //         .config_authorizer(create_authorizer),
            // )
            .route("/", web::get().to(index))
            .service(
                web::scope("/users")
                    .service(login_user)
                    .service(update_profile)
                    .service(list_friends)
                    .service(add_friend)
                    .service(remove_friend)
                    .service(show_users)
                    .service(user_detail)
                    .service(create_user),
            )
            .service(
                web::scope("/games")
                    .service(show_games)
                    .service(game_detail)
                    .service(create_game)
                    .service(crate::games::play_game_ws),
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
