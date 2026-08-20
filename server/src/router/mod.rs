// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use crate::authenticator::{get_user_from_store, register_user, TokenResponse};
use crate::discussions::{CreateDiscussion, CreatePost};
use crate::games::CreateGame;
use crate::mails::{CreateMail, MailQuery};
use crate::model::games::{create_game_in_db, get_game_in_db, list_games_in_db};
use crate::model::users::{create_user_in_db, get_user_in_db, list_users_in_db};
use crate::model::users::{CreateUserError, find_user_by_name_in_db};
use crate::session::{
    LogoutRequest, extract_access_claims, invalidate_claim, is_revoked, revoke_refresh_token,
};
use crate::users::{CreateUser, UpdateProfile};
use crate::model::{discussions, mails, users};
use crate::AppState;
use actix_security::http::security::{PasswordEncoder, User};
use actix_security::permit_all;
use actix_security::prelude::AuthenticatedUser;
use actix_web::{get, HttpRequest, HttpResponse, post, put, Responder, web};
use serde_json;
use std::sync::Arc;

pub async fn index() -> HttpResponse {
    HttpResponse::Ok().body("Welcome")
}

#[get("/show")]
pub async fn show_users(pool: web::Data<Arc<AppState>>) -> impl Responder {
    let mut db = pool
        .database
        .lock()
        .expect("show_users expect DatabaseInitializer");
    match list_users_in_db(&mut db) {
        Ok(users) => HttpResponse::Ok().json(users),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not load users: {}", err),
        })),
    }
}

#[get("/login")]
pub async fn login_user(
    pool: web::Data<Arc<AppState>>,
    user: AuthenticatedUser,
    req: HttpRequest,
) -> impl Responder {
    let auth_header = req
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok());

    // A Bearer request already holds a token, so there is nothing to mint here.
    if auth_header.is_some_and(|h| h.starts_with("Bearer ")) {
        return HttpResponse::Ok().json(serde_json::json!([]));
    }

    // The middleware already verified the credentials to build `AuthenticatedUser`,
    // so this only resolves the profile row behind the authenticated name.
    let name = user.into_inner().get_username().to_string();
    let found_in_db = {
        let mut db = pool
            .database
            .lock()
            .expect("login_user expect DatabaseInitializer");
        find_user_by_name_in_db(&mut db, &name)
    };
    match found_in_db {
        Ok(Some(db_user)) => {
            let store_user = match get_user_from_store(&db_user.name) {
                Ok(store_user) => store_user,
                Err(_) => {
                    return HttpResponse::Unauthorized().json(serde_json::json!({
                        "message": "Unexisting user",
                    }))
                }
            };
            match pool.jwt_token_service.generate_token_pair(&store_user) {
                Ok(pair) => HttpResponse::Ok().json(TokenResponse::new(
                    pair.access_token,
                    pair.refresh_token,
                    pair.token_type,
                    pair.expires_in,
                )),
                Err(e) => HttpResponse::InternalServerError().body(format!("Token error: {}", e)),
            }
        }
        Ok(None) => HttpResponse::Unauthorized().json(serde_json::json!({
            "message": "Unexisting user",
        })),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not load user: {}", err),
        })),
    }
}

#[get("/me")]
pub async fn get_user(pool: web::Data<Arc<AppState>>, user: AuthenticatedUser) -> impl Responder {
    // Same as /login: authentication happened in the middleware, this is a lookup.
    let name = user.into_inner().get_username().to_string();
    let found_in_db = {
        let mut db = pool
            .database
            .lock()
            .expect("get_user expect DatabaseInitializer");
        find_user_by_name_in_db(&mut db, &name)
    };
    match found_in_db {
        Ok(Some(db_user)) => HttpResponse::Ok().json(serde_json::json!(db_user)),
        _ => HttpResponse::Unauthorized().json(serde_json::json!({
            "message": "Unexisting user",
        })),
    }
}

#[post("/logout")]
pub async fn logout(
    pool: web::Data<Arc<AppState>>,
    req: HttpRequest,
    body: Option<web::Json<LogoutRequest>>,
) -> HttpResponse {
    match extract_access_claims(&pool, req) {
        Err(e) => {
            let message = format!("{}", e);
            HttpResponse::Unauthorized().json(serde_json::json!({
                "message": message,
        }))
        },
        Ok(Some((access_claims, raw_token))) => {
            invalidate_claim(&pool, access_claims, body, raw_token);
            HttpResponse::Ok().json(serde_json::json!({
                "message": "Logged out successfully",
            }))
        },
        Ok(None) => HttpResponse::Unauthorized().json(serde_json::json!({
            "message": "Invalid or expired access token",
        }))
    }
}

/// Exchange a refresh token for a new access/refresh pair.
///
/// The refresh token in the body is the *only* credential: this route is
/// registered outside the authenticated scope in `main.rs`, because the access
/// token an `Authorization` header would carry is precisely the thing that has
/// expired by the time a client needs to refresh. Requiring one made the
/// endpoint unreachable exactly when it was needed.
///
/// Being reachable without a header is safe only because the token is fully
/// validated here — signature, issuer, audience and expiry via
/// `validate_token`, then revocation via the blacklist. An attacker without a
/// valid refresh token gets 401; forging one needs the signing secret, and
/// anyone holding that could mint access tokens directly.
///
/// The full path is spelled out rather than nested under `web::scope("/users")`
/// so it can live outside the guarded scope without a second `/users` scope
/// shadowing the authenticated routes.
#[permit_all]
#[post("/users/refresh_token")]
pub async fn refresh_token(
    pool: web::Data<Arc<AppState>>,
    body: web::Json<serde_json::Value>,
) -> impl Responder {
    let raw_refresh = match body.get("refresh_token").and_then(|v| v.as_str()) {
        Some(t) => t,
        None => return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "refresh_token is missing"
        }))
    };

    let claims = match pool.jwt_token_service.validate_token(raw_refresh) {
        Ok(claims) => claims,
        Err(e) => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": format!("Invalid refresh token: {}", e)
        }))
    };

    // Refuse a token logout revoked, or that an earlier refresh already spent.
    // A second use means two parties hold it, so honouring it would hand a
    // stolen token a fresh pair — and without this check logout did not end a
    // session at all: the access token died but the refresh token kept minting
    // replacements for the rest of its life.
    if is_revoked(&pool, claims.jti.as_deref(), raw_refresh) {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Refresh token has been revoked"
        }));
    }

    match pool.jwt_token_service.refresh_tokens(raw_refresh) {
        Ok(pair) => {
            // Rotation: the replacement pair is live, so retire the one just
            // spent. Only after a successful mint — revoking first would strand
            // the client with nothing if generation failed.
            revoke_refresh_token(&pool, raw_refresh, &claims);
            HttpResponse::Ok().json(TokenResponse::new(
                pair.access_token,
                pair.refresh_token,
                pair.token_type,
                pair.expires_in
            ))
        },
        Err(e) => HttpResponse::Unauthorized().json(serde_json::json!({
            "error": format!("Invalid refresh token: {}", e)
        }))
    }
}

#[permit_all]
#[post("/register")]
pub async fn create_user(
    pool: web::Data<Arc<AppState>>,
    body: web::Json<CreateUser>,
) -> impl Responder {
    // validate first — no DB needed. The rules live on CreateUser so they are
    // stated (and unit-tested) once, rather than restated here.
    if let Err(message) = body.validate() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "success": false,
            "message": message,
        }));
    }

    // Hash once, outside the lock — Argon2 is deliberately slow and the DB mutex is
    // shared by every request. The same hash is then persisted *and* put in the auth
    // store, so both sides agree without waiting for a restart to resynchronise.
    let encoded = pool.encoder.encode(&body.password);

    let result = {
        let mut db = pool
            .database
            .lock()
            .expect("create_user: DatabaseInitializer");
        create_user_in_db(&mut db, &body, &encoded)
    };

    match result {
        Ok(_) => {
            let auth_user =
                User::with_encoded_password(&body.name, encoded).roles(&["USER".into()]);
            register_user(auth_user);
            HttpResponse::Created().json(serde_json::json!({
                "success": true,
                "message": format!("Created user: {}", body.name),
                "email": body.email,
            }))
        }
        Err(CreateUserError::AlreadyExists) => HttpResponse::Conflict().json(serde_json::json!({
            "success": false,
            "message": "A user with that name or email already exists.",
            "email": body.email,
        })),
        Err(CreateUserError::DatabaseError(e)) => {
            HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "message": format!("Registration failed: {}", e),
            }))
        }
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

#[put("/update/{id}")]
pub async fn update_user_profile(
    pool: web::Data<Arc<AppState>>,
    user: AuthenticatedUser,
    path: web::Path<(i32,)>,
    update: web::Json<UpdateProfile>,
) -> impl Responder {
    let target_id = path.into_inner().0;

    if let Err(message) = update.validate() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "message" : message,
        }));
    }

    let username = user.into_inner().get_username().to_string();

    let mut db = match pool.database.lock() {
        Ok(db) => db,
        Err(_) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "message" : "Database lock failed."
            }));
        }
    };

    let session_id = match users::find_user_id_by_name(&mut db, &username) {
        Ok(Some(id)) => id,
        Ok(None) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "message" : "User not found in db."
            }));
        }
        Err(err) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "message": format!("User lookup failed: {}", err),
            }));
        }
    };

    if session_id != target_id {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "message" : "User-mismatch, you are not editing your own profile."
        }));
    }

    match users::update_user_profile_in_db(
        &mut db,
        session_id,
        update.bio.as_deref(),
        update.avatar_url.as_deref(),
    ) {
        Ok(Some(updated)) => HttpResponse::Ok().json(updated),
        // This is just a shizo precaution. Row would need to be deleted
        // between this and the lookup. Kept so the server does not panic.
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "message": format!("User {} was not found.", target_id),
        })),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not update user {}: {}", target_id, err),
        })),
    }
}

#[get("/show")]
pub async fn show_discussions(pool: web::Data<Arc<AppState>>) -> impl Responder {
    let mut db = pool
        .database
        .lock()
        .expect("show_discussions expect DatabaseInitializer");
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
    let mut db = pool
        .database
        .lock()
        .expect("discussion_detail expect DatabaseInitializer");
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

    let mut db = pool
        .database
        .lock()
        .expect("create_discussion expect DatabaseInitializer");
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

    let mut db = pool
        .database
        .lock()
        .expect("create_discussion_post expect DatabaseInitializer");
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

    let mut db = pool
        .database
        .lock()
        .expect("show_mail expect DatabaseInitializer");
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
    let mut db = pool
        .database
        .lock()
        .expect("mail_detail expect DatabaseInitializer");
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

    let mut db = pool
        .database
        .lock()
        .expect("create_mail expect DatabaseInitializer");
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
    let mut db = pool
        .database
        .lock()
        .expect("show_games expect DatabaseInitializer");
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
    let mut db = pool
        .database
        .lock()
        .expect("game_detail expect DatabaseInitializer");
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
    user: AuthenticatedUser,
    body: web::Json<CreateGame>,
) -> impl Responder {
    let name = body.name.trim();
    let script_body = body.body.as_str();
    let script_body_trimmed = script_body.trim();

    if name.is_empty() || name.len() > 100 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "message": "Game name must be between 1 and 100 characters.",
        }));
    }

    if script_body_trimmed.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "message": "Game script body cannot be empty.",
        }));
    }

    if script_body.len() > 100 * 1024 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "message": "Game script body exceeds maximum allowed size of 100 KB.",
        }));
    }

    let username = user.into_inner().get_username().to_string();

    let mut db = match pool.database.lock() {
        Ok(db) => db,
        Err(_) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "message": "Database lock poisoned.",
            }));
        }
    };

    let author_id = match users::find_user_id_by_name(&mut db, &username) {
        Ok(Some(id)) => id,
        Ok(None) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "message": "Authenticated user not found in database.",
            }))
        }
        Err(err) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "message": format!("Could not lookup user: {}", err),
            }))
        }
    };

    match create_game_in_db(&mut db, author_id, name, script_body) {
        Ok(game) => HttpResponse::Created().json(game),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not create game: {}", err),
        })),
    }
}

#[get("/history")]
pub async fn get_game_history(
    pool: web::Data<Arc<AppState>>,
    user: AuthenticatedUser,
) -> impl Responder {
    let username = user.into_inner().get_username().to_string();

    let mut db = match pool.database.lock() {
        Ok(db) => db,
        Err(_) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "message": "Database lock poisoned.",
            }))
        }
    };

    let user_id = match users::find_user_id_by_name(&mut db, &username) {
        Ok(Some(id)) => id,
        Ok(None) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "message": "Authenticated user not found in database.",
            }))
        }
        Err(err) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "message": format!("Could not lookup user: {}", err),
            }))
        }
    };

    match crate::model::games::get_game_history_for_user_in_db(&mut db, user_id) {
        Ok(history) => HttpResponse::Ok().json(history),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not load game history: {}", err),
        })),
    }
}

#[get("/leaderboard")]
pub async fn get_leaderboard(pool: web::Data<Arc<AppState>>) -> impl Responder {
    let mut db = match pool.database.lock() {
        Ok(db) => db,
        Err(_) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "message": "Database lock poisoned.",
            }))
        }
    };

    match crate::model::games::get_leaderboard_in_db(&mut db) {
        Ok(leaderboard) => HttpResponse::Ok().json(leaderboard),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not load leaderboard: {}", err),
        })),
    }
}

#[get("/health")]
pub async fn health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({"status" : "ok"}))
}

#[cfg(test)]
mod router_tests {
    use super::*;
    use crate::games::Lobby;
    use crate::model::database_initializer::{initialize_db, OAuthConfig};
    use crate::status::StatusRegistry;
    use actix_security::http::security::Argon2PasswordEncoder;
    use actix_security::prelude::{JwtAuthenticator, JwtConfig, JwtTokenService, User};
    use actix_web::http::StatusCode;
    use base64::engine::general_purpose::STANDARD;
    use base64::Engine;
    use actix_web::{App, test};
    use std::collections::HashSet;
    use std::sync::{Arc, Mutex, RwLock};

    fn make_state() -> Arc<AppState> {
        let db = initialize_db();
        let jwt_config = JwtConfig::new(&db.server_environment.get_jwt_hash())
            .issuer("fttranscendence")
            .audience("api-users")
            .expiration_hours(24);
        let jwt_token_service = JwtTokenService::new(jwt_config.clone()).refresh_expiration_days(7);
        let jwt_authenticator = JwtAuthenticator::new(jwt_config);
        Arc::new(AppState {
            database: Mutex::new(db),
            lobby: Mutex::new(Lobby::new()),
            status: Mutex::new(StatusRegistry::new()),
            encoder: Argon2PasswordEncoder::new(),
            jwt_authenticator,
            jwt_token_service,
            token_blacklist: RwLock::new(HashSet::new()),
            oauth: OAuthConfig::from_env(),
        })
    }

    fn make_token_pair(state: &Arc<AppState>) -> (String, String) {
        let user = User::new("testuser".into(), "password".into());
        let pair = state
            .jwt_token_service
            .generate_token_pair(&user)
            .expect("Token pair generation failed in test");
        let refresh = pair.refresh_token.expect("Expected a refresh token");
        (pair.access_token, refresh)
    }

    /// The Authorization value a real client sends: the JWT base64-wrapped
    /// inside the Bearer value, matching `authHeaderFor` in `api.ts` and what
    /// `extract_access_claims` decodes.
    ///
    /// A raw JWT is *not* valid base64 — the `.` separators are rejected — so
    /// sending one here makes every request 401 before it reaches the handler.
    fn bearer(access_token: &str) -> String {
        format!("Bearer {}", STANDARD.encode(access_token))
    }

    #[actix_web::test]
    async fn refresh_token_works() {
        let state = make_state();
        let (access, refresh) = make_token_pair(&state);
        let app = test::init_service(
            App::new()
                .app_data(actix_web::web::Data::new(state.clone()))
                .service(refresh_token),
        )
            .await;

        let req = test::TestRequest::post()
            .uri("/users/refresh_token")
            .insert_header(("Authorization", bearer(&access)))
            .insert_header(("Content-Type", "application/json"))
            .set_payload(format!(r#"{{"refresh_token":"{}"}}"#, refresh))
            .to_request();

        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), StatusCode::OK);
        // Rotation: the refresh token just spent is retired, so it cannot be
        // exchanged a second time.
        assert_eq!(state.token_blacklist.read().unwrap().len(), 1);
        let body = test::read_body(resp).await;
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("Response is not valid JSON");
        let obj = json.as_object().expect("Response body is not a JSON object");
        assert_eq!(obj.len(), 4, "Expected exactly 4 fields in the response body");
        assert!(obj.contains_key("access_token"),  "Missing field: access_token");
        assert!(obj.contains_key("refresh_token"), "Missing field: refresh_token");
        assert!(obj.contains_key("expires_in"),    "Missing field: expires_in");
        assert!(obj.contains_key("token_type"),    "Missing field: token_type");

    }

    /// The endpoint is public on purpose: a client refreshes because its access
    /// token expired, so it has no Authorization header left to send. The
    /// refresh token in the body is the whole credential.
    #[actix_web::test]
    async fn refresh_token_works_without_auth_header() {
        let state = make_state();
        let (_access, refresh) = make_token_pair(&state);
        let app = test::init_service(
            App::new()
                .app_data(actix_web::web::Data::new(state.clone()))
                .service(refresh_token),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/users/refresh_token")
            .insert_header(("Content-Type", "application/json"))
            .set_payload(format!(r#"{{"refresh_token":"{}"}}"#, refresh))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::OK);
    }

    /// Public does not mean unprotected: without a valid refresh token there is
    /// nothing to exchange, so an anonymous caller gets 401 rather than a pair.
    #[actix_web::test]
    async fn refresh_token_with_garbage_is_rejected() {
        let state = make_state();
        let app = test::init_service(
            App::new()
                .app_data(actix_web::web::Data::new(state.clone()))
                .service(refresh_token),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/users/refresh_token")
            .insert_header(("Content-Type", "application/json"))
            .set_payload(r#"{"refresh_token":"not.a.real.jwt"}"#)
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
        assert_eq!(state.token_blacklist.read().unwrap().len(), 0);
    }

    /// Reuse detection: a refresh token is single-use, so presenting it twice
    /// means two parties hold it. The second attempt is refused instead of
    /// handing a possibly-stolen token a fresh pair.
    #[actix_web::test]
    async fn refresh_token_reuse_is_rejected() {
        let state = make_state();
        let (_access, refresh) = make_token_pair(&state);
        let app = test::init_service(
            App::new()
                .app_data(actix_web::web::Data::new(state.clone()))
                .service(refresh_token),
        )
        .await;

        let send = || {
            test::TestRequest::post()
                .uri("/users/refresh_token")
                .insert_header(("Content-Type", "application/json"))
                .set_payload(format!(r#"{{"refresh_token":"{}"}}"#, refresh))
                .to_request()
        };

        let first = test::call_service(&app, send()).await;
        assert_eq!(first.status(), StatusCode::OK);

        let second = test::call_service(&app, send()).await;
        assert_eq!(second.status(), StatusCode::UNAUTHORIZED);
    }

    /// Logging out must actually end the session. Before the blacklist check
    /// the access token died but the refresh token kept minting replacements
    /// for the rest of its life, so logout revoked nothing that mattered.
    #[actix_web::test]
    async fn refresh_token_revoked_by_logout_is_rejected() {
        let state = make_state();
        let (access, refresh) = make_token_pair(&state);
        let app = test::init_service(
            App::new()
                .app_data(actix_web::web::Data::new(state.clone()))
                .service(logout)
                .service(refresh_token),
        )
        .await;

        let logout_req = test::TestRequest::post()
            .uri("/logout")
            .insert_header(("Authorization", bearer(&access)))
            .insert_header(("Content-Type", "application/json"))
            .set_payload(format!(r#"{{"refresh_token":"{}"}}"#, refresh))
            .to_request();
        assert_eq!(
            test::call_service(&app, logout_req).await.status(),
            StatusCode::OK
        );

        let refresh_req = test::TestRequest::post()
            .uri("/users/refresh_token")
            .insert_header(("Content-Type", "application/json"))
            .set_payload(format!(r#"{{"refresh_token":"{}"}}"#, refresh))
            .to_request();

        let resp = test::call_service(&app, refresh_req).await;
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }

    // ── Happy paths ────────────────────────────────────────────────────────

    /// Access token only (no body): access token is blacklisted, returns 200.
    #[actix_web::test]
    async fn logout_access_token_only_returns_200() {
        let state = make_state();
        let (access, _) = make_token_pair(&state);
        let app = test::init_service(
            App::new()
                .app_data(actix_web::web::Data::new(state.clone()))
                .service(logout),
        )
            .await;

        let req = test::TestRequest::post()
            .uri("/logout")
            .insert_header(("Authorization", bearer(&access)))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(state.token_blacklist.read().unwrap().len(), 1);

        // Not just "something was blacklisted" — the *key* has to be the one
        // `authenticator::authenticate_jwt` looks up, which is the decoded JWT
        // (this library never populates `jti`, so the fallback is the only
        // path). Logout used to store the base64 wrapper instead, so the two
        // never matched and revocation silently did nothing.
        assert!(
            state.token_blacklist.read().unwrap().contains(&access),
            "blacklist must be keyed by the decoded JWT, not the base64 wrapper",
        );
    }

    /// Both tokens provided: exactly two entries appear in the blacklist.
    #[actix_web::test]
    async fn logout_both_tokens_blacklists_two_entries() {
        let state = make_state();
        let (access, refresh) = make_token_pair(&state);
        let app = test::init_service(
            App::new()
                .app_data(actix_web::web::Data::new(state.clone()))
                .service(logout),
        )
            .await;

        let req = test::TestRequest::post()
            .uri("/logout")
            .insert_header(("Authorization", bearer(&access)))
            .insert_header(("Content-Type", "application/json"))
            .set_payload(format!(r#"{{"refresh_token":"{}"}}"#, refresh))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::OK);
        // access jti + refresh jti (or raw strings if jti absent)
        assert_eq!(state.token_blacklist.read().unwrap().len(), 2);
    }

    /// Double-logout is idempotent: same token submitted twice still yields 200.
    #[actix_web::test]
    async fn logout_twice_is_idempotent() {
        let state = make_state();
        let (access, _) = make_token_pair(&state);
        let app = test::init_service(
            App::new()
                .app_data(actix_web::web::Data::new(state.clone()))
                .service(logout),
        )
            .await;

        for _ in 0..2 {
            let req = test::TestRequest::post()
                .uri("/logout")
                .insert_header(("Authorization", bearer(&access)))
                .to_request();
            let resp = test::call_service(&app, req).await;
            assert_eq!(resp.status(), StatusCode::OK);
        }
    }

    // ── Edge cases ─────────────────────────────────────────────────────────

    /// No Authorization header → 401, blacklist untouched.
    #[actix_web::test]
    async fn logout_without_auth_header_returns_401() {
        let state = make_state();
        let app = test::init_service(
            App::new()
                .app_data(actix_web::web::Data::new(state.clone()))
                .service(logout),
        )
            .await;

        let req = test::TestRequest::post().uri("/logout").to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
        assert!(state.token_blacklist.read().unwrap().is_empty());
    }

    /// Malformed access token → 401, blacklist untouched.
    #[actix_web::test]
    async fn logout_with_invalid_access_token_returns_401() {
        let state = make_state();
        let app = test::init_service(
            App::new()
                .app_data(actix_web::web::Data::new(state.clone()))
                .service(logout),
        )
            .await;

        let req = test::TestRequest::post()
            .uri("/logout")
            .insert_header(("Authorization", "Bearer this.is.not.a.real.jwt"))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
        assert!(state.token_blacklist.read().unwrap().is_empty());
    }

    /// Invalid refresh token does NOT fail the request — access token is still
    /// revoked and 200 is returned.
    #[actix_web::test]
    async fn logout_invalid_refresh_token_still_succeeds() {
        let state = make_state();
        let (access, _) = make_token_pair(&state);
        let app = test::init_service(
            App::new()
                .app_data(actix_web::web::Data::new(state.clone()))
                .service(logout),
        )
            .await;

        let req = test::TestRequest::post()
            .uri("/logout")
            .insert_header(("Authorization", bearer(&access)))
            .insert_header(("Content-Type", "application/json"))
            .set_payload(r#"{"refresh_token":"not.a.valid.jwt"}"#)
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::OK);
        // Only the access token was blacklisted.
        assert_eq!(state.token_blacklist.read().unwrap().len(), 1);
    }
}
