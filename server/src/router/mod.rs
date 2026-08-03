// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use crate::authenticator::{get_user_from_store, register_user, TokenResponse};
use crate::discussions::{CreateDiscussion, CreatePost};
use crate::games::GameInfo;
use crate::mails::{CreateMail, MailQuery};
use crate::model::database_initializer::{connection, DatabaseInitializer};
use crate::model::users::{create_user_in_db, get_user_in_db, list_users_in_db};
use crate::model::users::{CreateUserError, DbUser, login_user_in_db};
use crate::users::CreateUser;
use crate::session::{LogoutRequest, extract_access_claims, invalidate_claim};
use crate::model::{discussions, mails, users};
use crate::AppState;
use actix_security::http::security::{Argon2PasswordEncoder, PasswordEncoder, User};
use actix_security::permit_all;
use actix_security::prelude::{AuthenticatedUser, SessionAuthenticator, SessionConfig};
use actix_web::dev::ServiceRequest;
use actix_web::guard::Guard;
use actix_web::web::{Data, ReqData};
use actix_web::{get, HttpRequest, HttpResponse, post, Responder, web};
use diesel::prelude::*;
use diesel::row::NamedRow;
use serde_json;
use std::sync::Arc;

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

    match auth_header {
        Some(h) if h.starts_with("Bearer ") => {
            return HttpResponse::Ok().json(serde_json::json!([]))
        }
        Some(_) => println!("auth_header not contains Bearer"),
        None => println!("auth_header not present"),
    };
    let name = user.clone().into_inner().get_username().to_string();
    let pwd = user.into_inner().get_password().to_string();
    let mut db = pool
        .database
        .lock()
        .expect("create_user expect DatabaseInitializer");
    let logged_from_db = login_user_in_db(
        &mut db,
        &DbUser::new(
            0,
            name,
            "".to_string(),
            pwd,
            "".to_string(),
            "".to_string(),
            vec![],
        ),
    );
    match logged_from_db {
        Ok(Some(dbUser)) => {
            let user = get_user_from_store(&dbUser.name).unwrap();
            match pool.jwt_token_service.generate_token_pair(&user) {
                Ok(pair) => HttpResponse::Ok().json(TokenResponse::new(
                    pair.access_token,
                    pair.refresh_token,
                    pair.token_type,
                    pair.expires_in,
                )),
                Err(e) => HttpResponse::InternalServerError().body(format!("Token error: {}", e)),
            }
            //HttpResponse::Ok().json(serde_json::json!(dbUser))
        }
        Ok(None) => HttpResponse::Unauthorized().json(serde_json::json!({
            "message": "Unexisting user",
        })),
        Err(_) => todo!("Error is not handled"),
    }
}

#[get("/me")]
pub async fn get_user(pool: web::Data<Arc<AppState>>, user: AuthenticatedUser) -> impl Responder {
    let name = user.clone().into_inner().get_username().to_string();
    let pwd = user.into_inner().get_password().to_string();
    let mut db = pool
        .database
        .lock()
        .expect("create_user expect DatabaseInitializer");
    let logged_from_db = login_user_in_db(
        &mut db,
        &DbUser::new(
            0,
            name,
            "".to_string(),
            pwd,
            "".to_string(),
            "".to_string(),
            vec![],
        ),
    );
    match logged_from_db {
        Ok(Some(dbUser)) => HttpResponse::Ok().json(serde_json::json!(dbUser)),
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
    // let Some((access_claims, raw_token)) = extract_access_claims(pool, req);

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

#[permit_all]
#[post("/register")]
pub async fn create_user(
    pool: web::Data<Arc<AppState>>,
    body: web::Json<CreateUser>,
) -> impl Responder {
    // validate first — no DB needed
    if body.name.trim().is_empty()
        || body.email.trim().is_empty()
        || body.password.trim().is_empty()
    {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "success": false,
            "message": "Name, email, and password are required.",
        }));
    }

    // scope the lock so it is released before encoding
    let result = {
        let mut db = pool
            .database
            .lock()
            .expect("create_user: DatabaseInitializer");
        create_user_in_db(&mut db, &body, &pool.encoder)
    };

    match result {
        Ok(_) => {
            let encoded = pool.encoder.encode(&body.password);
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

pub fn list_games_in_db(
    db: &mut DatabaseInitializer,
) -> Result<Vec<GameInfo>, diesel::result::Error> {
    use crate::schema::ftt_games::dsl as games;

    let conn = connection(db);
    games::ftt_games
        .order(games::id.asc())
        .select(GameInfo::as_select())
        .load::<GameInfo>(conn)
}

pub fn get_game_in_db(
    db: &mut DatabaseInitializer,
    game_id: i32,
) -> Result<Option<GameInfo>, diesel::result::Error> {
    use crate::schema::ftt_games::dsl as games;

    let conn = connection(db);
    games::ftt_games
        .filter(games::id.eq(game_id))
        .select(GameInfo::as_select())
        .first::<GameInfo>(conn)
        .optional()
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

#[cfg(test)]
mod logout_tests {
    use super::*;
    use crate::games::Lobby;
    use crate::model::database_initializer::inittialize_db;
    use actix_security::http::security::{Argon2PasswordEncoder, SessionFixationStrategy};
    use actix_security::prelude::{
        JwtAuthenticator, JwtConfig, JwtTokenService, SessionConfig, User,
    };
    use actix_web::http::StatusCode;
    use actix_web::{App, test};
    use std::collections::HashSet;
    use std::sync::{Arc, Mutex, RwLock};

    fn make_state() -> Arc<AppState> {
        let db = inittialize_db();
        let jwt_config = JwtConfig::new(&db.server_environment.get_jwt_hash())
            .issuer("fttranscendence")
            .audience("api-users")
            .expiration_hours(24);
        let jwt_token_service = JwtTokenService::new(jwt_config.clone()).refresh_expiration_days(7);
        let jwt_authenticator = JwtAuthenticator::new(jwt_config);
        Arc::new(AppState {
            database: Mutex::new(db),
            lobby: Lobby::new(),
            encoder: Argon2PasswordEncoder::new(),
            session_config: SessionConfig::new()
                .user_key("user")
                .fixation_strategy(SessionFixationStrategy::MigrateSession),
            jwt_authenticator,
            jwt_token_service,
            token_blacklist: RwLock::new(HashSet::new()),
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
            .insert_header(("Authorization", format!("Bearer {}", access)))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(state.token_blacklist.read().unwrap().len(), 1);
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
            .insert_header(("Authorization", format!("Bearer {}", access)))
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
                .insert_header(("Authorization", format!("Bearer {}", access)))
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
            .insert_header(("Authorization", format!("Bearer {}", access)))
            .insert_header(("Content-Type", "application/json"))
            .set_payload(r#"{"refresh_token":"not.a.valid.jwt"}"#)
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), StatusCode::OK);
        // Only the access token was blacklisted.
        assert_eq!(state.token_blacklist.read().unwrap().len(), 1);
    }
}