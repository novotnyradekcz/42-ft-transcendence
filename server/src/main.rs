// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved.

mod model;
mod router;
mod schema;
mod users;

use std::sync::Mutex;
use crate::model::inittialize_db;
use crate::router::*;
use actix_web::{web, App, HttpServer};
use actix_security::{secured, pre_authorize};
use actix_security::http::security::{AuthenticatedUser, AuthenticationManager, AuthorizationManager, Argon2PasswordEncoder, PasswordEncoder, User, MemoryAuthenticator};
use actix_security::http::security::middleware::SecurityTransform;
use serde::{Deserialize, Serialize};

fn authenticate(enc: Argon2PasswordEncoder) -> MemoryAuthenticator {
    AuthenticationManager::in_memory_authentication()
        .password_encoder(enc.clone())
        .with_user(
            User::with_encoded_password("admin", enc.encode("admin"))
                .roles(&["ADMIN".into(), "USER".into()])
                .authorities(&["posts:write".into()])
        )
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let db = web::Data::new(Mutex::new(inittialize_db()));
    let encoder = Argon2PasswordEncoder::new();
    HttpServer::new(move || {
        let enc = encoder.clone();
        let dbc = db.clone();
        App::new()
            .wrap(
                SecurityTransform::new()
                    .config_authenticator(authenticate(enc))
                    .config_authorizer(|| {
                        AuthorizationManager::request_matcher()
                            .http_basic()
                    })
            )
            .app_data(dbc)
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
                    .service(game_detail),
            )
    })
    .bind(("0.0.0.0", 8080))?
    .run()
    .await
}
