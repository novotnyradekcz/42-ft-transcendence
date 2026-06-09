// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved.

mod model;
mod router;
mod schema;
mod users;

use crate::model::inittialize_db;
use crate::router::*;
use actix_web::{web, App, HttpServer};
use std::sync::Mutex;

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
