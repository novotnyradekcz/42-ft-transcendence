// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved.

mod model;
mod router;
mod schema;
mod users;
mod authenticator;

use std::sync::{Arc, Mutex};
use crate::authenticator::{create_authenticator, create_authorizer};
use crate::model::inittialize_db;
use crate::router::{index, show_users, user_detail, create_user, show_games, game_detail};
use actix_web::{web, App, HttpServer, Error as ActixError};
use actix_security::http::security::{Argon2PasswordEncoder, PasswordEncoder};
use actix_security::http::security::middleware::SecurityTransform;
use serde::{Deserialize, Serialize};

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
                    .config_authenticator(create_authenticator)
                    .config_authorizer(create_authorizer)
            )
            .app_data(dbc)
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
    })
    .bind(("0.0.0.0", 8080))?
    .run()
    .await
}
