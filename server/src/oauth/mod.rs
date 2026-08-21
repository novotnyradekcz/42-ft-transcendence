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

/// `id` doubles as the path segment: "github" -> /auth/github.
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

/// `/{provider}` and `/{provider}/callback` are top-level navigations, so a JSON
/// body would be rendered as a page. Send them back to the app with the reason.
fn oauth_failed(pool: &AppState, message: &str) -> HttpResponse {
    let base = pool.oauth.after_login_url();
    let target = Url::parse_with_params(&base, &[("oauth_error", message)])
        .map(String::from)
        .unwrap_or(base);

    HttpResponse::Found()
        .append_header(("Location", target))
        .finish()
}

/// Only providers we have credentials for, so the menu never offers a dud.
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

/// Mint a `state`, stash it, send the browser to the provider.
/// Only `client_id` goes out; the secret stays here.
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
            return oauth_failed(
                &pool,
                &format!("{provider_id} sign-in is not configured on this server"),
            );
        }
    };

    let state: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(32)
        .map(char::from)
        .collect();

    // keyed by provider so two tabs mid-login don't clobber each other
    if session.insert(state_key(&provider_id), &state).is_err() {
        return oauth_failed(&pool, "Could not start the OAuth flow");
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
            return oauth_failed(&pool, "Could not start the OAuth flow");
        }
    };

    HttpResponse::Found()
        .append_header(("Location", redirect.as_str()))
        .finish()
}

/// Check `state`, swap the code for a token, fetch the profile, log them in.
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
            return oauth_failed(
                &pool,
                &format!("{provider_id} sign-in is not configured on this server"),
            );
        }
    };

    if let Some(err) = &query.error {
        return oauth_failed(
            &pool,
            &format!("{} refused the authorization: {}", provider.spec.label, err),
        );
    }

    // consumed no matter what, so a replayed callback finds nothing
    let expected = session
        .remove_as::<String>(&state_key(&provider_id))
        .and_then(|r| r.ok());

    let received = query.state.as_deref().unwrap_or_default();
    match expected {
        Some(ref e) if e == received && !received.is_empty() => {}
        _ => {
            return oauth_failed(&pool, "Invalid OAuth state — start the login again");
        }
    }

    // only now is it safe to touch `code`
    let code = match query.code.as_deref() {
        Some(c) if !c.is_empty() => c,
        _ => {
            return oauth_failed(&pool, "Missing authorization code");
        }
    };

    let client = awc::Client::default();

    let token: AccessToken = match client
        .post(provider.spec.token_url)
        .insert_header(("User-Agent", "ft_transcendence"))
        // GitHub returns form-encoded unless asked for JSON; others ignore this
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
                return oauth_failed(
                    &pool,
                    &format!("Unexpected response from {}", provider.spec.label),
                );
            }
        },
        Ok(resp) => {
            log::error!(
                "{provider_id} rejected the code exchange: HTTP {}",
                resp.status()
            );
            return oauth_failed(
                &pool,
                &format!("{} rejected the authorization code", provider.spec.label),
            );
        }
        Err(e) => {
            log::error!("could not reach {provider_id} for the code exchange: {e}");
            return oauth_failed(&pool, &format!("Could not reach {}", provider.spec.label));
        }
    };

    // a Value because the three providers agree on nothing
    let raw_profile: serde_json::Value = match client
        .get(provider.spec.profile_url)
        .insert_header(("Authorization", format!("Bearer {}", token.access_token)))
        .insert_header(("User-Agent", "ft_transcendence"))
        .insert_header(("Accept", "application/json"))
        .send()
        .await
    {
        Ok(mut resp) if resp.status().is_success() => {
            match resp.json::<serde_json::Value>().await {
                Ok(v) => v,
                Err(e) => {
                    log::error!("{provider_id} profile was not valid JSON: {e}");
                    return oauth_failed(
                        &pool,
                        &format!("Unexpected profile response from {}", provider.spec.label),
                    );
                }
            }
        }
        Ok(resp) => {
            log::error!(
                "{provider_id} refused the profile request: HTTP {}",
                resp.status()
            );
            return oauth_failed(
                &pool,
                &format!("Could not read your {} profile", provider.spec.label),
            );
        }
        Err(e) => {
            log::error!("could not reach {provider_id} for the profile: {e}");
            return oauth_failed(&pool, &format!("Could not reach {}", provider.spec.label));
        }
    };

    let mut profile = match parse_profile(provider, &raw_profile) {
        Some(p) => p,
        None => {
            log::error!("{provider_id} profile lacked a usable id: {raw_profile}");
            return oauth_failed(
                &pool,
                &format!("Unexpected profile response from {}", provider.spec.label),
            );
        }
    };

    // GitHub hides private emails from /user. The frontend rejects a user
    // with no email, so go fetch the real one.
    if profile.email.is_empty() && provider.spec.id == "github" {
        if let Some(email) = github_primary_email(&client, &token.access_token).await {
            profile.email = email;
        }
    }

    // scoped: never hold the db lock across an .await
    let db_user = {
        let mut db = pool
            .database
            .lock()
            .expect("oauth_callback expects DatabaseInitializer");
        match find_or_create_oauth_user(&mut db, &profile, &pool.encoder) {
            Ok(u) => u,
            Err(e) => {
                log::error!("could not resolve the {provider_id} identity to a user: {e}");
                return oauth_failed(&pool, "Could not complete the login");
            }
        }
    };

    // the store is filled at boot, so a brand new user isn't in it yet
    if get_user_from_store(&db_user.name).is_err() {
        register_user(
            User::with_encoded_password(&db_user.name, db_user.password.clone())
                .roles(&["USER".into()]),
        );
    }

    // just the id, and only until /auth/session spends it. tokens in a URL
    // end up in history, referrers and proxy logs
    if session.insert("user_id", db_user.id).is_err() {
        return oauth_failed(&pool, "Could not start your session");
    }

    HttpResponse::Found()
        .append_header(("Location", pool.oauth.after_login_url()))
        .finish()
}

/// Swaps the OAuth cookie for the same JWT pair `/users/login` hands out, so
/// nothing downstream cares how the login happened. One-shot: the id is
/// removed as it's read.
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
                "message": "User does not exist",
            }));
        }
    };

    let store_user = match get_user_from_store(&user_info.name) {
        Ok(u) => u,
        Err(_) => {
            log::error!("user {} is absent from the user store", user_info.name);
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "message": "User does not exist",
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

/// Flattens three very different profile payloads into one shape.
/// The provider's id is the only thing we refuse to guess at — everything
/// else falls back.
fn parse_profile(provider: &OAuthProvider, raw: &serde_json::Value) -> Option<OAuthProfile> {
    let email = raw
        .get("email")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();

    let (id, login) = match provider.spec.id {
        // both give a numeric id and a username
        "42" | "github" => {
            let id = raw.get("id").and_then(json_id)?;
            let login = raw
                .get("login")
                .and_then(|v| v.as_str())
                .map(str::to_string)
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

/// Ids come back as numbers or strings depending on who you ask. Take either.
fn json_id(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::Number(n) => Some(n.to_string()),
        serde_json::Value::String(s) if !s.is_empty() => Some(s.clone()),
        _ => None,
    }
}

const GITHUB_EMAILS_URL: &str = "https://api.github.com/user/emails";

/// Primary verified address from /user/emails.
/// Verified only — an unverified one is just something they typed, so trusting
/// it would let anyone claim an address. None is fine; no email isn't fatal.
async fn github_primary_email(client: &awc::Client, access_token: &str) -> Option<String> {
    let mut response = client
        .get(GITHUB_EMAILS_URL)
        .insert_header(("Authorization", format!("Bearer {access_token}")))
        .insert_header(("User-Agent", "ft_transcendence"))
        .insert_header(("Accept", "application/json"))
        .send()
        .await
        .map_err(|e| log::error!("could not reach GitHub for the email list: {e}"))
        .ok()?;

    if !response.status().is_success() {
        log::error!(
            "GitHub refused the email list: HTTP {} (is the user:email scope granted?)",
            response.status()
        );
        return None;
    }

    let emails = response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| log::error!("GitHub email list was not valid JSON: {e}"))
        .ok()?;

    let entries = emails.as_array()?;
    let verified = |e: &&serde_json::Value| {
        e.get("verified").and_then(serde_json::Value::as_bool) == Some(true)
    };

    entries
        .iter()
        .find(|e| {
            verified(e) && e.get("primary").and_then(serde_json::Value::as_bool) == Some(true)
        })
        // any verified one beats none
        .or_else(|| entries.iter().find(verified))
        .and_then(|e| e.get("email"))
        .and_then(serde_json::Value::as_str)
        .map(str::to_string)
}
