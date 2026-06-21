// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved.

mod model;
mod router;
mod schema;
mod users;
mod authenticator;
mod discussions;
mod mails;

use std::sync::{Arc, Mutex};
use model::database_initializer::inittialize_db;
use crate::router::{index, show_users, user_detail, create_user, show_games, game_detail, show_discussions, discussion_detail, create_discussion, create_discussion_post, show_mail, mail_detail, create_mail};
use actix_web::{web, App, HttpServer, cookie};
use actix_security::http::security::{Argon2PasswordEncoder, PasswordEncoder, SessionFixationStrategy};
use actix_security::http::security::middleware::SecurityTransform;
use actix_security::prelude::{JwtAuthenticator, JwtTokenService, SessionConfig, User};
use actix_session::{storage::CookieSessionStore, SessionMiddleware};
use actix_web::web::Data;
use crate::authenticator::{create_authenticator, create_authorizer, init_user_store};
use users::user_handler::get_all_users_from_db;

struct AppState {
    users: Vec<User>,
    encoder: Argon2PasswordEncoder,
    session_config: SessionConfig,
    jwt_authenticator: Option<JwtAuthenticator>,
    jwt_token_service: Option<JwtTokenService>,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));
    let db = Data::new(Mutex::new(inittialize_db()));
    let encoder = Argon2PasswordEncoder::new();
    let encoder_data: Data<Argon2PasswordEncoder> = Data::new(encoder.clone());
    let dbusers = get_all_users_from_db(&db).expect("Users from DB failed.");
    let users: Vec<User> = dbusers.iter().map(|user| {
        //TODO change later to plain password_hash from database, where passwords will be already encoded
        User::with_encoded_password(user.name.as_str(), encoder.encode(user.password.as_str())).roles(&["USER".into()])
    }).collect();

    let session_config = SessionConfig::new().user_key("user").fixation_strategy(SessionFixationStrategy::MigrateSession);
    let state = Arc::new(AppState {
        users: users.clone(),
        encoder,
        session_config,
        jwt_authenticator: None,
        jwt_token_service: None,
    });
    let secret_key = cookie::Key::generate();

    init_user_store(users);

    HttpServer::new(move || {

        App::new()
            .app_data(db.clone())
            .app_data(Data::new(state.clone()))
            .app_data(encoder_data.clone())
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
                   // .service(login_user)
                    .service(show_users)
                    .service(user_detail)
                    .service(create_user),
            )
            .service(
                web::scope("/games")
                    .service(show_games)
                    .service(game_detail),
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
