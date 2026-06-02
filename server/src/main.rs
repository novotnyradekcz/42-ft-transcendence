// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved.

mod model;
mod users;
mod router;

use actix_web::{App, HttpServer, web};
use serde::{Serialize, Deserialize};
use crate::model::inittialize_db;
use crate::router::*;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let db = inittialize_db();
    HttpServer::new(|| {
        App::new()
            .route("/", web::get().to(index))
            .service(
                web::scope("/users")
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