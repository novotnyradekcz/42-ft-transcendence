// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use crate::AppState;
use actix_session::Session;
use actix_web::{get, web, HttpResponse, Responder};
use rand::{distributions::Alphanumeric, Rng};
use std::sync::Arc;
use url::Url;
use crate::model::users::{find_or_create_oauth_user, OAuthProfile};
use serde::Deserialize;

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

#[derive(Deserialize)]
pub struct CallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
}

#[derive(Deserialize)]
struct TokenResponse {
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

    let token: TokenResponse = match client
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
        Ok(mut resp) if resp.status().is_success() => match resp.json::<TokenResponse>().await {
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
    let user = {
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

    if session.insert("user_id", user.id).is_err() {
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

