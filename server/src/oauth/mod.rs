// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use crate::authenticator::{get_user_from_store, register_user, TokenResponse};
use crate::model::database_initializer::OAuthProvider;
use crate::model::users::{find_or_create_oauth_user, get_user_in_db, OAuthProfile};
use crate::AppState;
use actix_security::prelude::User;
use actix_session::Session;
use actix_web::{get, web, HttpResponse, Responder};
use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use url::Url;

/// One entry in the sign-in menu. `id` is the path segment: a provider listed
/// as `"github"` is started at `/auth/github`, so the frontend never needs its
/// own table of provider routes.
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
struct AccessToken {
    access_token: String,
}

/// The providers this server can actually complete a login with.
///
/// Configured ones only: a deployment without GitHub credentials offers
/// nothing for GitHub rather than an entry that fails when chosen.
#[get("/providers")]
pub async fn oauth_providers(pool: web::Data<Arc<AppState>>) -> impl Responder {
    let providers: Vec<ProviderInfo> = pool
        .oauth
        .all_configured()
        .map(|p| ProviderInfo {
            id: p.spec.id,
            label: p.spec.label,
        })
        .collect();

    HttpResponse::Ok().json(serde_json::json!({ "providers": providers }))
}

/// Steps 1-2 of the flow: mint a per-browser `state`, remember it, and hand the
/// browser off to the provider. Nothing secret leaves the server — `client_id`
/// is public by design; only `client_secret` stays behind.
#[get("/{provider}")]
pub async fn oauth_start(
    pool: web::Data<Arc<AppState>>,
    session: Session,
    path: web::Path<String>,
) -> impl Responder {
    let provider_id = path.into_inner();
    let provider = match pool.oauth.configured(&provider_id) {
        Some(p) => p,
        None => {
            return HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "message": format!("{provider_id} sign-in is not configured on this server"),
            }));
        }
    };

    let state: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(32)
        .map(char::from)
        .collect();

    // Keyed by provider so two tabs mid-handshake with different providers do
    // not overwrite each other's state.
    if session
        .insert(state_key(&provider_id), &state)
        .is_err()
    {
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "message": "Could not start the OAuth flow",
        }));
    }

    let redirect = match Url::parse_with_params(
        provider.spec.authorize_url,
        &[
            ("client_id", provider.client_id.as_str()),
            ("redirect_uri", provider.redirect_uri.as_str()),
            ("response_type", "code"),
            ("scope", provider.spec.scope),
            ("state", state.as_str()),
        ],
    ) {
        Ok(url) => url,
        Err(e) => {
            log::error!("could not build the {provider_id} authorize URL: {e}");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "message": "Could not start the OAuth flow",
            }));
        }
    };

    HttpResponse::Found()
        .append_header(("Location", redirect.as_str()))
        .finish()
}

/// Steps 5-10: verify `state`, redeem the code over the back channel, fetch the
/// profile, resolve it to a local user, and start a session.
#[get("/{provider}/callback")]
pub async fn oauth_callback(
    pool: web::Data<Arc<AppState>>,
    session: Session,
    path: web::Path<String>,
    query: web::Query<CallbackQuery>,
) -> impl Responder {
    let provider_id = path.into_inner();
    let provider = match pool.oauth.configured(&provider_id) {
        Some(p) => p,
        None => {
            return HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "message": format!("{provider_id} sign-in is not configured on this server"),
            }));
        }
    };

    if let Some(err) = &query.error {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "message": format!("{} refused the authorization: {}", provider.spec.label, err),
        }));
    }

    // Consume the stored state unconditionally: one flow, one use. Doing this
    // before anything else means a replayed callback finds nothing to match.
    let expected = session
        .remove_as::<String>(&state_key(&provider_id))
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

    // Only now is it safe to touch `code`.
    let code = match query.code.as_deref() {
        Some(c) if !c.is_empty() => c,
        _ => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "message": "Missing authorization code",
            }));
        }
    };

    let client = awc::Client::default();

    let token: AccessToken = match client
        .post(provider.spec.token_url)
        .insert_header(("User-Agent", "ft_transcendence"))
        // GitHub answers the token endpoint in form-encoded by default and
        // only returns JSON when asked. The others ignore this header.
        .insert_header(("Accept", "application/json"))
        .send_form(&[
            ("grant_type", "authorization_code"),
            ("client_id", provider.client_id.as_str()),
            ("client_secret", provider.client_secret.as_str()),
            ("code", code),
            ("redirect_uri", provider.redirect_uri.as_str()),
        ])
        .await
    {
        Ok(mut resp) if resp.status().is_success() => match resp.json::<AccessToken>().await {
            Ok(t) => t,
            Err(e) => {
                log::error!("{provider_id} token response was not the expected shape: {e}");
                return HttpResponse::BadGateway().json(serde_json::json!({
                    "message": format!("Unexpected response from {}", provider.spec.label),
                }));
            }
        },
        Ok(resp) => {
            log::error!(
                "{provider_id} rejected the code exchange: HTTP {}",
                resp.status()
            );
            return HttpResponse::BadGateway().json(serde_json::json!({
                "message": format!("{} rejected the authorization code", provider.spec.label),
            }));
        }
        Err(e) => {
            log::error!("could not reach {provider_id} for the code exchange: {e}");
            return HttpResponse::BadGateway().json(serde_json::json!({
                "message": format!("Could not reach {}", provider.spec.label),
            }));
        }
    };

    // Parsed as a Value because the three providers agree on nothing: 42 and
    // GitHub give a numeric `id` and a `login`, Google a string `sub` and no
    // username at all.
    let raw_profile: serde_json::Value = match client
        .get(provider.spec.profile_url)
        .insert_header(("Authorization", format!("Bearer {}", token.access_token)))
        .insert_header(("User-Agent", "ft_transcendence"))
        .insert_header(("Accept", "application/json"))
        .send()
        .await
    {
        Ok(mut resp) if resp.status().is_success() => match resp.json::<serde_json::Value>().await {
            Ok(v) => v,
            Err(e) => {
                log::error!("{provider_id} profile was not valid JSON: {e}");
                return HttpResponse::BadGateway().json(serde_json::json!({
                    "message": format!("Unexpected profile response from {}", provider.spec.label),
                }));
            }
        },
        Ok(resp) => {
            log::error!(
                "{provider_id} refused the profile request: HTTP {}",
                resp.status()
            );
            return HttpResponse::BadGateway().json(serde_json::json!({
                "message": format!("Could not read your {} profile", provider.spec.label),
            }));
        }
        Err(e) => {
            log::error!("could not reach {provider_id} for the profile: {e}");
            return HttpResponse::BadGateway().json(serde_json::json!({
                "message": format!("Could not reach {}", provider.spec.label),
            }));
        }
    };

    let profile = match parse_profile(provider, &raw_profile) {
        Some(p) => p,
        None => {
            log::error!("{provider_id} profile lacked a usable id: {raw_profile}");
            return HttpResponse::BadGateway().json(serde_json::json!({
                "message": format!("Unexpected profile response from {}", provider.spec.label),
            }));
        }
    };

    // Scoped so the mutex guard is dropped before the response is built, and so
    // no `.await` ever happens while the database lock is held.
    let db_user = {
        let mut db = pool
            .database
            .lock()
            .expect("oauth_callback expects DatabaseInitializer");
        match find_or_create_oauth_user(&mut db, &profile, &pool.encoder) {
            Ok(u) => u,
            Err(e) => {
                log::error!("could not resolve the {provider_id} identity to a user: {e}");
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
        .append_header(("Location", pool.oauth.after_login_url()))
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
pub async fn oauth_session(pool: web::Data<Arc<AppState>>, session: Session) -> impl Responder {
    let user_id = match session.remove_as::<i32>("user_id").and_then(|r| r.ok()) {
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

fn state_key(provider_id: &str) -> String {
    format!("oauth_state_{provider_id}")
}

/// Normalises the three providers' wildly different profile payloads.
///
/// The only field that must be present is the provider's own stable id — it is
/// what `(provider, provider_user_id)` is keyed on, and the one thing we refuse
/// to guess at. Everything else degrades: a missing name falls back to the
/// email's local part and then to the id, and a missing email to the empty
/// string, which is what the column defaults to anyway.
fn parse_profile(provider: &OAuthProvider, raw: &serde_json::Value) -> Option<OAuthProfile> {
    let email = raw
        .get("email")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();

    let (id, login) = match provider.spec.id {
        // 42 and GitHub both expose a numeric id and a username.
        "42" | "github" => {
            let id = raw.get("id").and_then(json_id)?;
            let login = raw
                .get("login")
                .and_then(|v| v.as_str())
                .map(str::to_string)
                .unwrap_or_else(|| id.clone());
            (id, login)
        }
        // Google has no username: `sub` is the stable id, and the closest thing
        // to a handle is the local part of the email.
        "google" => {
            let id = raw.get("sub").and_then(json_id)?;
            let login = raw
                .get("name")
                .and_then(|v| v.as_str())
                .map(str::to_string)
                .or_else(|| email.split('@').next().map(str::to_string))
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| id.clone());
            (id, login)
        }
        _ => return None,
    };

    Some(OAuthProfile {
        provider: provider.spec.id.to_string(),
        provider_user_id: id,
        login,
        email,
    })
}

/// Providers disagree on whether an id is a JSON number or a JSON string, and
/// the same provider can change its mind between endpoints. Accept either, and
/// store it as text.
fn json_id(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::Number(n) => Some(n.to_string()),
        serde_json::Value::String(s) if !s.is_empty() => Some(s.clone()),
        _ => None,
    }
}
