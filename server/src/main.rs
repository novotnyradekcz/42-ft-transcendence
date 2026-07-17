// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved.

mod authenticator;
mod discussions;
mod games;
mod mails;
mod model;
mod router;
mod schema;
mod users;


use crate::authenticator::{create_authenticator, create_authorizer, init_user_store};
use model::database_initializer::inittialize_db;
use crate::games::{Lobby, play_game_ws};
use crate::model::DatabaseInitializer;
use crate::model::users::get_all_users_from_db;
use crate::router::{index, show_users, login_user, user_detail, create_user, show_games, game_detail, create_game, show_discussions, discussion_detail, create_discussion, create_discussion_post, show_mail, mail_detail, create_mail};

use actix_security::http::security::{Argon2PasswordEncoder, SessionFixationStrategy};
use actix_security::http::security::middleware::SecurityTransform;
use actix_security::prelude::{JwtAuthenticator, JwtTokenService, SessionConfig, User};
use actix_session::{storage::CookieSessionStore, SessionMiddleware};
use actix_web::{web, App, HttpServer, cookie};
use actix_web::web::Data;
use std::sync::{Arc, Mutex};

#[allow(dead_code)]
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
    let secret_key = cookie::Key::generate();

    init_user_store(users);

    HttpServer::new(move || {
        App::new()
            .app_data(Data::new(state.clone()))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), secret_key.clone())
                    .cookie_secure(false)
                    .build(),
            )
            .wrap(
                SecurityTransform::new()
                    .config_authenticator(create_authenticator)
                    .config_authorizer(create_authorizer),
            )
            .route("/", web::get().to(index))
            .service(
                web::scope("/users")
                    .service(login_user)
                    .service(show_users)
                    .service(user_detail)
                    .service(create_user),
            )
            .service(
                web::scope("/games")
                    .service(show_games)
                    .service(game_detail)
                    .service(create_game)
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
