// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

//! Token revocation: reading the access token off a request, and retiring the
//! tokens that logout or a refresh has spent.
//!
//! A JWT is valid until it expires, so ending a session early means keeping a list
//! of the ones that no longer count. That list lives in two places — a `HashSet`
//! for the hot path, and `ftt_token_blacklist` so it survives a restart — and both
//! are written together.
//!
//! Every reader and writer has to key an entry the same way: the token's `jti`
//! when it has one, otherwise the *decoded* JWT. Disagreeing about that key is how
//! revocation silently stops working, which has happened here before.

use std::collections::HashSet;
use std::io::Error;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use actix_security::http::security::jwt::Claims;
use actix_web::{web, HttpRequest};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use diesel::prelude::*;

use crate::model::database_initializer::{connection, DatabaseInitializer};
use crate::AppState;

// ── Public types ─────────────────────────────────────────────────────────────

/// Optional request body for `POST /logout`.
/// The access token is always read from `Authorization: Bearer`; the refresh
/// token is passed here so both can be invalidated in one round-trip.
#[derive(serde::Deserialize)]
pub struct LogoutRequest {
    pub refresh_token: Option<String>,
}

// ── Public functions ─────────────────────────────────────────────────────────

/// Extract and validate the Bearer token from the request.
/// Returns `Ok(Some((claims, jwt)))` on success,
/// `Err` when the Authorization header is missing/malformed,
/// `Ok(None)` when the token signature is invalid.
///
/// The returned string is the **decoded** JWT, not the base64 wrapper the
/// header carries. That matters: it becomes the blacklist key for a token with
/// no `jti`, and `authenticator::authenticate_jwt` looks that key up using the
/// decoded form. Returning the wrapper here meant logout wrote one key and the
/// authenticator checked for another, so revoking a `jti`-less token silently
/// did nothing.
pub fn extract_access_claims(
    pool: &web::Data<Arc<AppState>>,
    req: HttpRequest,
) -> Result<Option<(Claims, String)>, Error> {
    let auth_header = req
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok());

    let raw_access = match auth_header {
        Some(h) if h.starts_with("Bearer ") => &h[7..],
        _ => return Err(Error::other("Missing or invalid Authorization header")),
    };

    let decoded = match STANDARD.decode(raw_access).ok() {
        Some(s) => s,
        None => return Err(Error::other("Missing or invalid Authorization header"))
    };
    let creds = match std::str::from_utf8(decoded.as_slice()).ok() {
        Some(s) => s,
        None => return Err(Error::other("Missing or invalid Authorization header"))
    };
    match pool.jwt_authenticator.validate_token(creds) {
        Ok(token_data) => Ok(Some((token_data.claims, creds.to_string()))),
        Err(_) => Ok(None),
    }
}

/// Revoke both tokens: persist each one to the database **and** add it to the
/// in-memory blacklist.  The database mutex is locked once for the whole call.
pub fn invalidate_claim(
    pool: &web::Data<Arc<AppState>>,
    access_claims: Claims,
    body: Option<web::Json<LogoutRequest>>,
    raw_access: String,
) {
    let mut db = pool
        .database
        .lock()
        .expect("invalidate_claim: database lock poisoned");

    blacklist_token(
        &pool.token_blacklist,
        &mut db,
        &raw_access,
        access_claims.jti,
        access_claims.exp as i64,
    );

    if let Some(body) = body {
        if let Some(ref raw_refresh) = body.refresh_token {
            if let Ok(refresh_claims) = pool.jwt_token_service.validate_token(raw_refresh) {
                blacklist_token(
                    &pool.token_blacklist,
                    &mut db,
                    raw_refresh,
                    refresh_claims.jti,
                    refresh_claims.exp as i64,
                );
            }
        }
    }
}

/// Whether a token has already been revoked — by logout, or by a previous
/// refresh that spent it.
///
/// Takes the same `jti`-or-raw key that `blacklist_token` writes and
/// `authenticator::authenticate_jwt` reads, so all three agree on the key.
pub fn is_revoked(
    pool: &web::Data<Arc<AppState>>,
    jti: Option<&str>,
    raw_token: &str,
) -> bool {
    let key = jti
        .map(str::to_string)
        .unwrap_or_else(|| raw_token.to_string());

    pool.token_blacklist
        .read()
        .expect("token_blacklist RwLock poisoned")
        .contains(&key)
}

/// Retire a refresh token that has just been exchanged for a new pair, so it
/// cannot be spent twice. This is the rotation half of the refresh flow: with
/// it, a stolen refresh token stops working the moment the real client next
/// refreshes, and the second attempt is visible as a revoked-token rejection.
pub fn revoke_refresh_token(
    pool: &web::Data<Arc<AppState>>,
    raw_refresh: &str,
    claims: &Claims,
) {
    let mut db = pool
        .database
        .lock()
        .expect("revoke_refresh_token: database lock poisoned");

    blacklist_token(
        &pool.token_blacklist,
        &mut db,
        raw_refresh,
        claims.jti.clone(),
        claims.exp as i64,
    );
}

/// Load every token from `ftt_token_blacklist` whose `expires_at` is still in
/// the future and return it as a `HashSet`.  Called once at startup so the
/// in-memory blacklist is consistent with the database after a restart.
pub fn load_valid_blacklisted_tokens(db: &mut DatabaseInitializer) -> HashSet<String> {
    use crate::schema::ftt_token_blacklist::dsl::{expires_at, ftt_token_blacklist, token_key};

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let conn = connection(db);

    // Purge expired entries so the table does not grow unboundedly.
    diesel::delete(ftt_token_blacklist.filter(expires_at.le(now)))
        .execute(conn)
        .unwrap_or_else(|e| {
            log::warn!(
                "[session] Failed to delete expired blacklisted tokens from DB: {}",
                e
            );
            0
        });

    ftt_token_blacklist
        .filter(expires_at.gt(now))
        .select(token_key)
        .load::<String>(conn)
        .unwrap_or_else(|e| {
            log::warn!("[session] Failed to load blacklisted tokens from DB: {}", e);
            vec![]
        })
        .into_iter()
        .collect()
}

// ── Private helpers ───────────────────────────────────────────────────────────

/// Persist one token to `ftt_token_blacklist` and insert its key into the
/// in-memory `HashSet`.  A duplicate key (double-logout) is silently ignored.
fn blacklist_token(
    blacklist: &std::sync::RwLock<HashSet<String>>,
    db: &mut DatabaseInitializer,
    raw: &str,
    jti: Option<String>,
    expires_at: i64,
) {
    let key = jti.unwrap_or_else(|| raw.to_string());

    // 1. Persist to the database (ON CONFLICT DO NOTHING handles duplicates).
    insert_blacklisted_token_in_db(db, key.as_str(), expires_at);

    // 2. Update the in-memory set.
    blacklist
        .write()
        .expect("token_blacklist RwLock poisoned")
        .insert(key);
}

fn insert_blacklisted_token_in_db(db: &mut DatabaseInitializer, key: &str, expires_at: i64) {
    use crate::model::session::NewBlacklistedToken;
    use crate::schema::ftt_token_blacklist;

    let entry = NewBlacklistedToken::new(key.to_string(), expires_at);

    let conn = connection(db);
    diesel::insert_into(ftt_token_blacklist::table)
        .values(&entry)
        .on_conflict(ftt_token_blacklist::token_key)
        .do_nothing()
        .execute(conn)
        .unwrap_or_else(|e| {
            log::error!("[session] Failed to persist blacklisted token to DB: {}", e);
            0
        });
}
