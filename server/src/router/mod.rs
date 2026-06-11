// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use std::sync::{Arc, Mutex};
//use actix_security::prelude::AuthenticatedUser;
//use actix_security::{pre_authorize, secured};
use actix_security::http::security::{AuthenticatedUser, AuthenticationManager, AuthorizationManager, Argon2PasswordEncoder, PasswordEncoder, User, MemoryAuthenticator, RequestMatcherAuthorizer, Access};
use serde::{Serialize, Deserialize};
use serde_json;
use downcast_rs::Downcast;
use actix_web::{App, HttpServer, HttpResponse, Responder, web, get, post};
use crate::users::{CreateUser, LoginUser};
use crate::model::user_handler::{create_user_in_db};
use crate::model::database_initializer::{DatabaseInitializer};
use crate::model::user_handler::CreateUserError;

pub async fn index() -> HttpResponse {
    HttpResponse::Ok().body("Welcome")
}

/*#[secured("ADMIN")]
#[get("/admin")]
async fn admin(user: AuthenticatedUser) -> impl Responder {
    HttpResponse::Ok().body(format!("Welcome, Admin {}!", user.get_username()))
}

#[pre_authorize("hasRole('USER') AND hasAuthority('posts:write')")]
#[post("/posts")]
async fn create_post(user: AuthenticatedUser) -> impl Responder {
    HttpResponse::Created().body("Post created")
}*/

#[get("/show")]
pub async fn show_users() -> impl Responder {
    HttpResponse::Created().json(serde_json::json!(
        {"menu": ["main menu", "add friend"],"users": [{
        "message": "User detail: 1",
        "endpoint": "users/show/1",
        "id": "1",
        "name": "User Name",
        "email": "user@email.ltd"
        },{
        "message": "User detail: 2",
        "endpoint": "users/show/2",
        "id": "2",
        "name": "User Name",
        "email": "user@email.ltd"
        }]})
    )
}

// pub fn create_authenticator(pool: web::Data<Argon2PasswordEncoder>) -> MemoryAuthenticator {
//     let encoder = pool.get_ref();
//     AuthenticationManager::in_memory_authentication()
//         .password_encoder(encoder.clone())
//         .with_user(
//             User::with_encoded_password("admin", encoder.encode("admin"))
//                 .roles(&["ADMIN".into(), "USER".into()])
//                 .authorities(&["posts:write".into()])
//         )
// }
//
// // Factory function: URL-based authorization rules
// pub fn create_authorizer() -> RequestMatcherAuthorizer {
//     AuthorizationManager::request_matcher()
//         .http_basic()
//         .add_matcher("/users/login", Access::new().roles(vec!["ADMIN"]))
//     // add more matchers per route as needed
// }

#[post("/login")]
pub async fn authenticate(body: web::Json<LoginUser>) -> impl Responder {
    HttpResponse::Created().json(serde_json::json!({
        "message": format!("Lugged user: {}", body.name),
    }))
}

#[post("/create")]
pub async fn create_user(pool: web::Data<Mutex<DatabaseInitializer>>, body: web::Json<CreateUser>) -> impl Responder {
    let mut db = pool.lock().unwrap();
    match create_user_in_db(&mut db, &body) {
        Ok(_) => {
            HttpResponse::Created().json(serde_json::json!({
                "success": true,
                "message": format!("Created user: {}", body.name),
                "email": body.email,
            }))
        }
        Err(err) => {
            let error = match err {
                CreateUserError::DatabaseError(e) => e.to_string(),
                CreateUserError::AlreadyExists => "User already exists".to_string()
            };
            HttpResponse::ExpectationFailed().json(serde_json::json!({
                "success": false,
                "message": format!("Creation of user failed: {}", error),
                "email": body.email,
            }))
        }

    }

}

#[get("/show/{id}")]
pub async fn user_detail(path: web::Path<(u32,)>) -> impl Responder {
    HttpResponse::Created().json(serde_json::json!({
        "message": format!("User detail: {}", path.into_inner().0),
        "endpoint": "users/show/{id}",
        "id": "{id}",
        "name": "User Name",
        "email": "user@email.ltd"
    }))
}

#[get("/show")]
pub async fn show_games() -> impl Responder {
    HttpResponse::Created().json(serde_json::json!({
        "body": "Game body",
        "name": "Game Name",
        "author": 1,
        "id": 1,
        "message": "Show games",
        "endpoint": "games/show",
    }))
}

#[get("/show/{id}")]
pub async fn game_detail(path: web::Path<(u32,)>) -> impl Responder {
    HttpResponse::Created().json(serde_json::json!({
        "body": "Game body",
        "name": "Game Name",
        "author": 1,
        "id": 1,
        "message": format!("Game detail: {}", path.into_inner().0),
        "endpoint": "games/show/{id}",
    }))
}