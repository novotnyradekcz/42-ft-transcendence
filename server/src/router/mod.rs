// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use serde::{Serialize, Deserialize};
use serde_json;
use actix_web::{App, HttpServer, HttpResponse, Responder, web, get, post};
use crate::users::CreateUser;

pub async fn index() -> HttpResponse {
    HttpResponse::Ok().body("Welcome")
}

#[get("/show")]
pub async fn show_users() -> HttpResponse {
    HttpResponse::Ok().body("Show users")
}

#[post("/login")]
pub async fn login_user() -> HttpResponse {
    HttpResponse::Ok().body("Show users")
}

#[post("/create")]
pub async fn create_user(body: web::Json<CreateUser>) -> impl Responder {
    HttpResponse::Created().json(serde_json::json!({
        "message": format!("Created user: {}", body.name),
        "email": body.email,
    }))
}

#[get("/show/{id}")]
pub async fn user_detail(path: web::Path<(u32,)>) -> HttpResponse {
    HttpResponse::Ok().body(format!("User detail: {}", path.into_inner().0))
}

#[get("/show")]
pub async fn show_games() -> HttpResponse {
    HttpResponse::Ok().body("Show games")
}

#[get("/show/{id}")]
pub async fn game_detail(path: web::Path<(u32,)>) -> HttpResponse {
    HttpResponse::Ok().body(format!("Game detail: {}", path.into_inner().0))
}