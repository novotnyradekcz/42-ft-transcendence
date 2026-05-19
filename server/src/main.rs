// Copyright (c) 2018, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved.

use actix_web::{App, HttpServer, Responder, web};
use std::io::Result;
use std::io::Error;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
struct Info {
    user_ud: u32,
    frien: String,
}

async fn index(path: web::Path<(String, String)>, json: web::Json<Info>) -> impl Responder {
    Ok::<String, Error>("Welcome".to_owned() + &path.1 + json.to_string())
}

#[actix_web::main]
async fn main() -> Result<()> {
    HttpServer::new(|| App::new().service(index))
        .bind(("127.0.0.1", 8080))?
        .run()
        .await
}