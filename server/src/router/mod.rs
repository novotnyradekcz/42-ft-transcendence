// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use crate::authenticator::register_user;
use crate::discussions::{CreateDiscussion, CreatePost, DiscussionInfo};
use crate::mails::{CreateMail, MailInfo, MailQuery};

use crate::model::discussions::{Discussion, Post};
use crate::model::users::CreateUserError;
use crate::model::users::{create_user_in_db, get_user_in_db, list_users_in_db};
use crate::users::CreateUser;
use crate::games::GameInfo;
use actix_security::http::security::{Argon2PasswordEncoder, PasswordEncoder, User};
use actix_web::{delete, get, HttpResponse, post, Responder, web};
use serde::Deserialize;
use crate::model::games::{get_game_in_db, list_games_in_db, CreateGame};
use std::sync::{Arc, Mutex};

use crate::model::mails::Mail;
use diesel::prelude::*;
use diesel::result::Error;
use serde_json;
use crate::AppState;
use crate::model::{discussions, mails, users};

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
pub async fn show_users(pool: web::Data<Arc<AppState>>) -> impl Responder {
    let mut db = pool.database.lock().expect("show_users expect DatabaseInitializer");
    match list_users_in_db(&mut db) {
        Ok(users) => HttpResponse::Ok().json(users),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not load users: {}", err),
        })),
    }
}

#[post("/create")]
pub async fn create_user(
    pool: web::Data<Arc<AppState>>,
    encoder: web::Data<Argon2PasswordEncoder>,
    body: web::Json<CreateUser>,
) -> impl Responder {
    let mut db = pool.database.lock().expect("create_user expect DatabaseInitializer");
    match create_user_in_db(&mut db, &body, encoder.get_ref()) {
        Ok(_) => {
            let encoded = encoder.encode(&body.password);
            let auth_user =
                User::with_encoded_password(&body.name, encoded).roles(&["USER".into()]);
            register_user(auth_user);

            HttpResponse::Created().json(serde_json::json!({
                "success": true,
                "message": format!("Created user: {}", body.name),
                "email": body.email,
            }))
        }
        Err(err) => {
            let error = match err {
                CreateUserError::DatabaseError(e) => e.to_string(),
                CreateUserError::AlreadyExists => "User already exists".to_string(),
            };
            HttpResponse::ExpectationFailed().json(serde_json::json!({
                "success": false,
                "message": format!("Creation of user failed: {}", error),
                "email": body.email,
            }))
        }
    }
}

#[derive(Deserialize)]
struct LoginRequest {
    name: String,
    password: String,
}

#[derive(Deserialize)]
struct UpdateProfileRequest {
    id: i32,
    name: String,
    email: String,
    #[serde(default)]
    bio: String,
    #[serde(rename = "avatarUrl", default)]
    avatar_url: String,
}

// The stateless endpoints below take the acting user's id explicitly (body or
// query) instead of reading it from a session; they carry no authentication
// until the real auth layer lands.
#[derive(Deserialize)]
struct FriendQuery {
    #[serde(rename = "userId")]
    user_id: Option<i32>,
}

/// Seed users (test/admin/guest) are stored as plaintext; users created via
/// `/users/create` are stored as Argon2 hashes. Verify against whichever form
/// the row actually holds.
fn password_matches(encoder: &Argon2PasswordEncoder, raw: &str, stored: &str) -> bool {
    if stored.starts_with("$argon2") {
        encoder.matches(raw, stored)
    } else {
        stored == raw
    }
}

/// Stateless credential check: verifies name/password and returns the user's
/// public info. No session or token is created.
#[post("/login")]
pub async fn login_user(
    pool: web::Data<Arc<AppState>>,
    encoder: web::Data<Argon2PasswordEncoder>,
    body: web::Json<LoginRequest>,
) -> impl Responder {
    let mut db = pool.database.lock().unwrap();

    let user = match users::get_user_by_name_in_db(&mut db, &body.name) {
        Ok(Some(user)) => user,
        Ok(None) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "message": "Name or password is incorrect.",
            }))
        }
        Err(err) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "message": format!("Could not load user: {}", err),
            }))
        }
    };

    if !password_matches(encoder.get_ref(), &body.password, user.password.as_str()) {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "message": "Name or password is incorrect.",
        }));
    }

    match get_user_in_db(&mut db, user.id) {
        Ok(Some(info)) => HttpResponse::Ok().json(info),
        Ok(None) => HttpResponse::Unauthorized().json(serde_json::json!({
            "message": "Name or password is incorrect.",
        })),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not load user: {}", err),
        })),
    }
}

#[post("/update")]
pub async fn update_profile(
    pool: web::Data<Arc<AppState>>,
    body: web::Json<UpdateProfileRequest>,
) -> impl Responder {
    if body.name.trim().is_empty() || body.email.trim().is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "message": "Name and email are required.",
        }));
    }

    let mut db = pool.database.lock().unwrap();

    // An empty avatarUrl means "leave the avatar unchanged".
    let avatar_url = if body.avatar_url.trim().is_empty() {
        match get_user_in_db(&mut db, body.id) {
            Ok(Some(existing)) => existing.avatar_url,
            _ => "/images/profile.png".to_string(),
        }
    } else {
        body.avatar_url.clone()
    };

    match users::update_user_profile_in_db(
        &mut db,
        body.id,
        body.name.trim(),
        body.email.trim(),
        body.bio.trim(),
        &avatar_url,
    ) {
        Ok(info) => HttpResponse::Ok().json(info),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not update profile: {}", err),
        })),
    }
}

#[get("/friends")]
pub async fn list_friends(
    pool: web::Data<Arc<AppState>>,
    query: web::Query<FriendQuery>,
) -> impl Responder {
    // Like /mail/show, no userId simply means no list to show.
    let uid = match query.user_id {
        Some(uid) => uid,
        None => return HttpResponse::Ok().json(serde_json::json!([])),
    };

    let mut db = pool.database.lock().unwrap();
    match users::list_friends_in_db(&mut db, uid) {
        Ok(friends) => HttpResponse::Ok().json(friends),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not load friends: {}", err),
        })),
    }
}

#[post("/friends/{id}")]
pub async fn add_friend(
    pool: web::Data<Arc<AppState>>,
    query: web::Query<FriendQuery>,
    path: web::Path<(i32,)>,
) -> impl Responder {
    let uid = match query.user_id {
        Some(uid) => uid,
        None => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "message": "userId is required.",
            }))
        }
    };

    let target = path.into_inner().0;
    if target == uid {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "message": "You cannot add yourself as a friend.",
        }));
    }

    let mut db = pool.database.lock().unwrap();

    match get_user_in_db(&mut db, target) {
        Ok(Some(_)) => {}
        Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "message": "User not found.",
            }))
        }
        Err(err) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "message": format!("Could not add friend: {}", err),
            }))
        }
    }

    match users::add_friend_in_db(&mut db, uid, target) {
        Ok(()) => match users::list_friends_in_db(&mut db, uid) {
            Ok(friends) => HttpResponse::Ok().json(friends),
            Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
                "message": format!("Could not load friends: {}", err),
            })),
        },
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not add friend: {}", err),
        })),
    }
}

#[delete("/friends/{id}")]
pub async fn remove_friend(
    pool: web::Data<Arc<AppState>>,
    query: web::Query<FriendQuery>,
    path: web::Path<(i32,)>,
) -> impl Responder {
    let uid = match query.user_id {
        Some(uid) => uid,
        None => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "message": "userId is required.",
            }))
        }
    };

    let target = path.into_inner().0;
    let mut db = pool.database.lock().unwrap();
    match users::remove_friend_in_db(&mut db, uid, target) {
        Ok(()) => match users::list_friends_in_db(&mut db, uid) {
            Ok(friends) => HttpResponse::Ok().json(friends),
            Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
                "message": format!("Could not load friends: {}", err),
            })),
        },
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not remove friend: {}", err),
        })),
    }
}

#[get("/show/{id}")]
pub async fn user_detail(
    pool: web::Data<Arc<AppState>>,
    path: web::Path<(i32,)>,
) -> impl Responder {
    let mut db = pool.database.lock().unwrap();
    let user_id = path.into_inner().0;

    match get_user_in_db(&mut db, user_id) {
        Ok(Some(user)) => HttpResponse::Ok().json(user),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "message": format!("User {} was not found.", user_id),
        })),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not load user {}: {}", user_id, err),
        })),
    }
}

#[get("/show")]
pub async fn show_discussions(pool: web::Data<Arc<AppState>>) -> impl Responder {
    let mut db = pool.database.lock().expect("show_discussions expect DatabaseInitializer");
    match discussions::list_discussions_in_db(&mut db) {
        Ok(discussions) => HttpResponse::Ok().json(discussions),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not load discussions: {}", err),
        })),
    }
}

#[get("/show/{id}")]
pub async fn discussion_detail(
    pool: web::Data<Arc<AppState>>,
    path: web::Path<(i32,)>,
) -> impl Responder {
    let mut db = pool.database.lock().expect("discussion_detail expect DatabaseInitializer");
    let discussion_id = path.into_inner().0;

    match discussions::get_discussion_in_db(&mut db, discussion_id) {
        Ok(Some(discussion)) => HttpResponse::Ok().json(discussion),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "message": format!("Discussion {} was not found.", discussion_id),
        })),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not load discussion {}: {}", discussion_id, err),
        })),
    }
}

#[post("/create")]
pub async fn create_discussion(
    pool: web::Data<Arc<AppState>>,
    body: web::Json<CreateDiscussion>,
) -> impl Responder {
    let author_id = match body.author {
        Some(author_id) => author_id,
        None => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "message": "Discussion author is required.",
            }))
        }
    };

    if body.name.trim().is_empty() || body.info.trim().is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "message": "Discussion title and body are required.",
        }));
    }

    let mut db = pool.database.lock().expect("create_discussion expect DatabaseInitializer");
    match discussions::create_discussion_in_db(&mut db, &body, author_id) {
        Ok(discussion) => HttpResponse::Created().json(discussion),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not create discussion: {}", err),
        })),
    }
}

#[post("/{id}/posts")]
pub async fn create_discussion_post(
    pool: web::Data<Arc<AppState>>,
    path: web::Path<(i32,)>,
    body: web::Json<CreatePost>,
) -> impl Responder {
    let author_id = match body.author {
        Some(author_id) => author_id,
        None => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "message": "Post author is required.",
            }))
        }
    };

    if body.body.trim().is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "message": "Post body is required.",
        }));
    }

    let mut db = pool.database.lock().expect("create_discussion_post expect DatabaseInitializer");
    match discussions::create_post_in_db(&mut db, path.into_inner().0, &body, author_id) {
        Ok(discussion) => HttpResponse::Created().json(discussion),
        Err(diesel::result::Error::NotFound) => HttpResponse::NotFound().json(serde_json::json!({
            "message": "Discussion was not found.",
        })),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not create post: {}", err),
        })),
    }
}

#[get("/show")]
pub async fn show_mail(
    pool: web::Data<Arc<AppState>>,
    query: web::Query<MailQuery>,
) -> impl Responder {
    let user_id = match query.user_id {
        Some(user_id) => user_id,
        None => return HttpResponse::Ok().json(serde_json::json!([])),
    };

    let mut db = pool.database.lock().expect("show_mail expect DatabaseInitializer");
    match mails::list_mail_in_db(&mut db, user_id) {
        Ok(mail) => HttpResponse::Ok().json(mail),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not load mail: {}", err),
        })),
    }
}

#[get("/show/{id}")]
pub async fn mail_detail(
    pool: web::Data<Arc<AppState>>,
    path: web::Path<(i32,)>,
) -> impl Responder {
    let mut db = pool.database.lock().expect("mail_detail expect DatabaseInitializer");
    let mail_id = path.into_inner().0;

    match mails::get_mail_in_db(&mut db, mail_id) {
        Ok(Some(mail)) => HttpResponse::Ok().json(mail),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "message": format!("Mail {} was not found.", mail_id),
        })),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not load mail {}: {}", mail_id, err),
        })),
    }
}

#[post("/create")]
pub async fn create_mail(
    pool: web::Data<Arc<AppState>>,
    body: web::Json<CreateMail>,
) -> impl Responder {
    let sender_id = match body.sender {
        Some(sender_id) => sender_id,
        None => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "message": "Mail sender is required.",
            }))
        }
    };

    if body.title.trim().is_empty() || body.body.trim().is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "message": "Mail title and body are required.",
        }));
    }

    let mut db = pool.database.lock().expect("create_mail expect DatabaseInitializer");
    let recipient_id = match (body.recipient, body.to.as_deref()) {
        (Some(recipient_id), _) => recipient_id,
        (None, Some(to)) => match users::find_user_id_by_name(&mut db, to) {
            Ok(Some(recipient_id)) => recipient_id,
            Ok(None) => {
                return HttpResponse::NotFound().json(serde_json::json!({
                    "message": format!("Recipient {} was not found.", to),
                }))
            }
            Err(err) => {
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "message": format!("Could not resolve recipient: {}", err),
                }))
            }
        },
        (None, None) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "message": "Mail recipient is required.",
            }))
        }
    };

    match mails::create_mail_in_db(&mut db, &body, sender_id, recipient_id) {
        Ok(mail) => HttpResponse::Created().json(mail),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not create mail: {}", err),
        })),
    }
}


#[get("/show")]
pub async fn show_games(pool: web::Data<Arc<AppState>>) -> impl Responder {
    let mut db = pool.database.lock().expect("show_games expect DatabaseInitializer");
    match list_games_in_db(&mut db) {
        Ok(games) => HttpResponse::Ok().json(games),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not load games: {}", err),
        })),
    }
}

#[get("/show/{id}")]
pub async fn game_detail(
    pool: web::Data<Arc<AppState>>,
    path: web::Path<(i32,)>,
) -> impl Responder {
    let mut db = pool.database.lock().expect("game_detail expect DatabaseInitializer");
    let game_id = path.into_inner().0;

    match get_game_in_db(&mut db, game_id) {
        Ok(Some(game)) => HttpResponse::Ok().json(game),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "message": format!("Game {} was not found.", game_id),
        })),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not load game {}: {}", game_id, err),
        })),
    }
}


#[post("/create")]
pub async fn create_game(
    pool: web::Data<Arc<AppState>>,
    body: web::Json<CreateGame>,
) -> impl Responder {
    if body.name.trim().is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "message": "Game name is required.",
        }));
    }

    if body.lua_code.trim().is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "message": "Lua code is required.",
        }));
    }

    let games_dir = std::env::var("GAMES_DIR").unwrap_or_else(|_| "../frontend/public/games".to_string());
    if let Err(err) = std::fs::create_dir_all(&games_dir) {
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not create games directory: {}", err),
        }));
    }

    let sanitized_name = body.name.to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect::<String>();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let filename = format!("{}_{}.lua", timestamp, sanitized_name);
    let file_path = std::path::Path::new(&games_dir).join(&filename);

    if let Err(err) = std::fs::write(&file_path, &body.lua_code) {
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not write Lua script to file: {}", err),
        }));
    }

    let game_link = format!("/games/{}", filename);

    let mut db = pool.database.lock().expect("create_game expect DatabaseInitializer");
    let conn = match db.connection.as_mut() {
        Some(c) => c,
        None => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "message": "Database connection not available",
            }));
        }
    };

    use crate::schema::ftt_games::dsl as games_dsl;
    match diesel::insert_into(games_dsl::ftt_games)
        .values((
            games_dsl::author.eq(body.author),
            games_dsl::name.eq(&body.name),
            games_dsl::body.eq(&game_link),
        ))
        .returning(GameInfo::as_returning())
        .get_result::<GameInfo>(conn)
    {
        Ok(game) => HttpResponse::Created().json(game),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not save game to database: {}", err),
        })),
    }
}

