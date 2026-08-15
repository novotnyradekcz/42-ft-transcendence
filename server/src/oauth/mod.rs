// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use crate::authenticator::{get_user_from_store, register_user, TokenResponse};
use crate::model::users::{find_or_create_oauth_user, get_user_in_db, OAuthProfile};
use crate::AppState;
use actix_security::prelude::User;
use actix_session::Session;
use actix_web::{get, web, HttpResponse, Responder};
use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use url::Url;

const AUTHORIZE_42_URL: &str = "https://api.intra.42.fr/oauth/authorize";
const TOKEN_42_URL: &str = "https://api.intra.42.fr/oauth/token";
const PROFILE_42_URL: &str = "https://api.intra.42.fr/v2/me";

/// Where the browser lands once the session exists. Derived from the
/// configured redirect URI rather than hardcoded: both point at the frontend
/// origin, so they cannot drift apart when the deployment moves (as it did
/// when the frontend went from :3000 to HTTPS on 443).
fn after_login_url(redirect_uri: &str) -> String {
    Url::parse(redirect_uri)
        .and_then(|u| u.join("/menu"))
        .map(String::from)
        .unwrap_or_else(|_| "/menu".to_string())
}

/// One entry in the sign-in menu. `id` is the path segment: a provider listed
/// as `"42"` is started at `/auth/42`, so the frontend never needs its own
/// table of provider routes.
#[derive(Serialize)]
struct ProviderInfo {
    id: &'static str,
    label: &'static str,
}

#[derive(Deserialize)]
pub struct CallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
}

#[derive(Deserialize)]
struct Intra42Token {
    access_token: String,
}

/// Only the fields we consume. 42's /v2/me returns a great deal more;
/// serde ignores unknown fields by default.
#[derive(Deserialize)]
struct Intra42Me {
    id: i64,
    login: String,
    email: Option<String>,
}

#[get("/42/callback")]
pub async fn auth_42_callback(
    pool: web::Data<Arc<AppState>>,
    session: Session,
    query: web::Query<CallbackQuery>,
    ) -> impl Responder {
    let cfg = &pool.oauth42;

    if let Some(err) = &query.error {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "message" : format!("42 refused the authorization: {}", err),
        }));
    }

    let expected = session
        .remove_as::<String>("oauth_state")
        .and_then(|r| r.ok());

    let received = query.state.as_deref().unwrap_or_default();
    match expected {
        Some(ref e) if e == received && !received.is_empty() => {}
        _ => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "message": "Invalid OAuth state — start the login again",
            }));
        }
    }

    let code = match query.code.as_deref() {
        Some(c) if !c.is_empty() => c,
        _ => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "message": "Missing authorization code",
            }));
        }
    };

    let client = awc::Client::default();

    let token: Intra42Token = match client
        .post(TOKEN_42_URL)
        .insert_header(("User-Agent", "ft_transcendence"))
        .send_form(&[
            ("grant_type", "authorization_code"),
            ("client_id", cfg.client_id.as_str()),
            ("client_secret", cfg.client_secret.as_str()),
            ("code", code),
            ("redirect_uri", cfg.redirect_uri.as_str()),
        ])
        .await {
        Ok(mut resp) if resp.status().is_success() => match resp.json::<Intra42Token>().await {
            Ok(t) => t,
            Err(e) => {
                log::error!("42 token response was not the expected shape: {e}");
                return HttpResponse::BadGateway().json(serde_json::json!({
                    "message": "Unexpected response from 42",
                }));
            }
        },
        Ok(resp) => {
            log::error!("42 rejected the code exchange: HTTP {}", resp.status());
            return HttpResponse::BadGateway().json(serde_json::json!({
                "message": "42 rejected the authorization code",
            }));
        }
        Err(e) => {
            log::error!("could not reach 42 for the code exchange: {e}");
            return HttpResponse::BadGateway().json(serde_json::json!({
                "message": "Could not reach 42",
            }));
        }
    };

    let me: Intra42Me = match client
        .get(PROFILE_42_URL)
        .insert_header(("Authorization", format!("Bearer {}", token.access_token)))
        .insert_header(("User-Agent", "ft_transcendence"))
        .send()
        .await
    {
        Ok(mut resp) if resp.status().is_success() => match resp.json::<Intra42Me>().await {
            Ok(m) => m,
            Err(e) => {
                log::error!("42 profile was not the expected shape: {e}");
                return HttpResponse::BadGateway().json(serde_json::json!({
                    "message": "Unexpected profile response from 42",
                }));
            }
        },
        Ok(resp) => {
            log::error!("42 refused the profile request: HTTP {}", resp.status());
            return HttpResponse::BadGateway().json(serde_json::json!({
                "message": "Could not read your 42 profile",
            }));
        }
        Err(e) => {
            log::error!("could not reach 42 for the profile: {e}");
            return HttpResponse::BadGateway().json(serde_json::json!({
                "message": "Could not reach 42",
            }));
        }
    };

    let profile = OAuthProfile {
        provider: "42".to_string(),
        provider_user_id: me.id.to_string(),
        login: me.login,
        email: me.email.unwrap_or_default(),
    };

    // Scoped so the mutex guard is dropped before the response is built, and so
    // no `.await` ever happens while the database lock is held.
    let db_user = {
        let mut db = pool
            .database
            .lock()
            .expect("auth_42_callback expects DatabaseInitializer");
        match find_or_create_oauth_user(&mut db, &profile, &pool.encoder) {
            Ok(u) => u,
            Err(e) => {
                log::error!("could not resolve the 42 identity to a user: {e}");
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "message": "Could not complete the login",
                }));
            }
        }
    };

    // JWT minting reads from the in-memory user store, which is populated at
    // boot from the database. A user created moments ago by the branch above is
    // not in it yet, so register it here — the same thing /register does after
    // creating a row.
    if get_user_from_store(&db_user.name).is_err() {
        register_user(
            User::with_encoded_password(&db_user.name, db_user.password.clone())
                .roles(&["USER".into()]),
        );
    }

    // Only the user id goes in the cookie, and only until /auth/session spends
    // it. The token pair itself is never put in a URL, where it would land in
    // browser history, referrer headers and proxy logs.
    if session.insert("user_id", db_user.id).is_err() {
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "message": "Could not start your session",
        }));
    }

    HttpResponse::Found()
        .append_header(("Location", after_login_url(&cfg.redirect_uri)))
        .finish()
}

#[get("/42")]
pub async fn auth_42(pool: web::Data<Arc<AppState>>, session: Session) -> impl Responder {
    let cfg = &pool.oauth42;

    if !cfg.is_configured() {
        return HttpResponse::ServiceUnavailable().json(serde_json::json!(
                {"message" : "42 OAuth is not configured on this server",}));
    }

    let state: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(32)
        .map(char::from)
        .collect();

    if session.insert("oauth_state", &state).is_err() {
        return HttpResponse::InternalServerError().json(serde_json::json!(
                {"message" : "Could not start the OAuth flow",}));
    }
    
    let redirect = Url::parse_with_params(
        AUTHORIZE_42_URL,
        &[
            ("client_id", cfg.client_id.as_str()),
            ("redirect_uri", cfg.redirect_uri.as_str()),
            ("response_type", "code"),
            ("scope", "public"),
            ("state", state.as_str()),
        ]
    ).expect("AUTHORIZE_42_URL is a valid URL");

    HttpResponse::Found()
        .append_header(("Location", redirect.as_str()))
        .finish()
}


/// Trades the short-lived OAuth cookie for the same JWT pair `/users/login`
/// issues, so an OAuth user is indistinguishable from a password user from
/// here on: same Authorization header, same refresh rotation, same WebSocket
/// auth. Nothing downstream needs to know how the login happened.
///
/// One-shot by construction — the id is removed from the session as it is read,
/// so a replayed request finds nothing to spend.
#[get("/session")]
pub async fn oauth_session(
    pool: web::Data<Arc<AppState>>,
    session: Session,
) -> impl Responder {
    let user_id = match session
        .remove_as::<i32>("user_id")
        .and_then(|r| r.ok())
    {
        Some(id) => id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "message": "No OAuth session to exchange",
            }));
        }
    };

    let user_info = {
        let mut db = pool
            .database
            .lock()
            .expect("oauth_session expects DatabaseInitializer");
        get_user_in_db(&mut db, user_id)
    };

    let user_info = match user_info {
        Ok(Some(u)) => u,
        _ => {
            log::error!("OAuth session referenced user id {user_id}, which no longer exists");
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "message": "Unexisting user",
            }));
        }
    };

    let store_user = match get_user_from_store(&user_info.name) {
        Ok(u) => u,
        Err(_) => {
            log::error!("user {} is absent from the user store", user_info.name);
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "message": "Unexisting user",
            }));
        }
    };

    match pool.jwt_token_service.generate_token_pair(&store_user) {
        Ok(pair) => HttpResponse::Ok().json(TokenResponse::new(
            pair.access_token,
            pair.refresh_token,
            pair.token_type,
            pair.expires_in,
        )),
        Err(e) => {
            log::error!("could not mint a token pair for an OAuth login: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "message": "Could not complete the login",
            }))
        }
    }
}

/// The providers this server can actually complete a login with.
///
/// Configured ones only: a deployment without 42 credentials offers nothing
/// rather than offering an entry that 503s when chosen. Adding Google or
/// GitHub later means adding their config alongside `oauth42` and pushing one
/// more entry here — the frontend menu needs no change, because it renders
/// whatever this returns.
#[get("/providers")]
pub async fn oauth_providers(pool: web::Data<Arc<AppState>>) -> impl Responder {
    let mut providers: Vec<ProviderInfo> = Vec::new();

    if pool.oauth42.is_configured() {
        providers.push(ProviderInfo {
            id: "42",
            label: "42 Intra",
        });
    }

    HttpResponse::Ok().json(serde_json::json!({ "providers": providers }))
}
