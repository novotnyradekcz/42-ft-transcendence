// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

//! Authenticating a WebSocket handshake.
//!
//! A browser can't set an `Authorization` header on a WS handshake, so credentials
//! arrive hex-encoded in `Sec-WebSocket-Protocol` instead and are unpacked here.
//! Both the game and status sockets go through this, which is also why those
//! scopes are mounted outside the HTTP security middleware in `main.rs`.
//!
//! Whichever scheme is used, the identity it proves must match the `user_id` in
//! the query string — otherwise a valid token would let anyone open a socket as
//! anybody.

use std::sync::Arc;
use actix_web::{Error, error::ErrorInternalServerError};
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use actix_security::http::security::{Argon2PasswordEncoder, PasswordEncoder};
use crate::AppState;
use crate::model::database_initializer::connection;
use crate::model::users::DbUser;

/// What the client proved before we touch the database.
enum WsAuth {
    /// A verified, non-blacklisted JWT. `username` is the token subject.
    Jwt { username: String },
    /// Basic Auth; the password still has to be checked against the stored hash.
    Basic { username: String, password: String },
}

/// Verifies a `Bearer base64(<jwt>)` value.
///
/// Mirrors `authenticator::authenticate_jwt`: the Bearer payload is the JWT
/// base64-encoded (the convention `api.ts` uses on the HTTP side), and a token
/// that logout has blacklisted is rejected even though it is still unexpired.
fn verify_jwt(pool: &Arc<AppState>, b64_jwt: &str) -> Option<WsAuth> {
    let decoded = STANDARD.decode(b64_jwt).ok()?;
    let raw_jwt = std::str::from_utf8(&decoded).ok()?;
    let token_data = pool.jwt_authenticator.validate_token(raw_jwt).ok()?;

    let blacklist_key = token_data
        .claims
        .jti
        .clone()
        .unwrap_or_else(|| raw_jwt.to_string());
    if pool
        .token_blacklist
        .read()
        .expect("token_blacklist RwLock poisoned")
        .contains(&blacklist_key)
    {
        return None;
    }

    Some(WsAuth::Jwt {
        username: token_data.claims.sub,
    })
}

/// Validates credentials supplied over the WebSocket auth subprotocol.
///
/// Accepts either scheme the HTTP API uses:
///   * `Bearer base64(<jwt>)` — preferred, and the only one that avoids putting
///     the password on the wire at every handshake.
///   * `Basic base64(username:password)` — retained for sessions with no token
///     yet (a freshly registered user).
///
/// Whichever scheme is used, the resolved identity must match `user_id`.
pub fn validate_credentials(
    pool: &Arc<AppState>,
    user_id: i32,
    auth: &str,
) -> Result<DbUser, Error> {
    // Resolve the claimed identity first — no DB work for a malformed header.
    let claimed = if let Some(b64_jwt) = auth.strip_prefix("Bearer ") {
        verify_jwt(pool, b64_jwt)
    } else if let Some(b64) = auth.strip_prefix("Basic ") {
        STANDARD
            .decode(b64)
            .ok()
            .and_then(|d| String::from_utf8(d).ok())
            .and_then(|creds| {
                creds
                    .split_once(':')
                    .map(|(username, password)| WsAuth::Basic {
                        username: username.to_string(),
                        password: password.to_string(),
                    })
            })
    } else {
        None
    };

    let claimed = claimed.ok_or_else(|| actix_web::error::ErrorUnauthorized("Invalid credentials"))?;

    let user_match = {
        let mut db_lock = pool
            .database
            .lock()
            .map_err(|_| ErrorInternalServerError("Database lock poisoned"))?;
        let conn = connection(&mut db_lock);

        use crate::schema::ftt_users::dsl::*;
        use diesel::prelude::*;

        ftt_users
            .filter(id.eq(user_id))
            .select(DbUser::as_select())
            .first::<DbUser>(conn)
            .optional()
            .map_err(ErrorInternalServerError)?
    };

    let validated = match (user_match, claimed) {
        // The socket may only act as the user it authenticated as.
        (Some(user_info), WsAuth::Jwt { username }) if user_info.name == username => Some(user_info),
        (Some(user_info), WsAuth::Basic { username, password }) if user_info.name == username => {
            let encoder = Argon2PasswordEncoder::new();
            if encoder.matches(&password, &user_info.password) {
                Some(user_info)
            } else {
                None
            }
        }
        _ => None,
    };

    match validated {
        Some(user) => Ok(user),
        None => Err(actix_web::error::ErrorUnauthorized("Invalid credentials")),
    }
}

/// Extracts auth credentials from the Sec-WebSocket-Protocol header.
/// Returns a tuple of (credentials, raw_subprotocol) if successful.
pub fn extract_auth_from_protocols(req: &actix_web::HttpRequest) -> Option<(String, String)> {
    let protocol_header = req.headers().get("Sec-WebSocket-Protocol")?.to_str().ok()?;
    for proto in protocol_header.split(',') {
        let proto = proto.trim();
        if let Some(hex_str) = proto.strip_prefix("auth-") {
            if let Some(bytes) = decode_hex(hex_str) {
                if let Ok(creds) = String::from_utf8(bytes) {
                    return Some((creds, proto.to_string()));
                }
            }
        }
    }
    None
}

// the subprotocol header is a comma-separated token list, so the credentials are
// hex rather than base64: base64 padding and `+/` don't survive it intact
fn decode_hex(s: &str) -> Option<Vec<u8>> {
    if s.len() % 2 != 0 {
        return None;
    }
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).ok())
        .collect()
}
