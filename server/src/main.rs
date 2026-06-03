// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved.

mod model;
mod router;
mod schema;
mod users;

use std::sync::Mutex;
use crate::model::inittialize_db;
use crate::router::*;
use actix_web::{web, App, HttpServer};
use serde::{Deserialize, Serialize};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let db = web::Data::new(Mutex::new(inittialize_db()));
    HttpServer::new(move || {
        let dbc = db.clone();
        App::new()
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
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
