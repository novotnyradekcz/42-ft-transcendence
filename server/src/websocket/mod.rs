// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use std::sync::Arc;
use actix_web::Error;
use actix_security::http::security::{Argon2PasswordEncoder, PasswordEncoder};
use crate::AppState;
use crate::model::users::DbUser;

/// Validates query-based credentials against the database.
/// Expects `auth` to be a Basic Auth formatted string ("Basic base64(username:password)").
pub fn validate_credentials(
    pool: &Arc<AppState>,
    user_id: i32,
    auth: &str,
) -> Result<DbUser, Error> {
    let validated = if let Some(b64) = auth.strip_prefix("Basic ") {
        if let Ok(decoded) = base64::decode(b64) {
            if let Ok(creds) = std::str::from_utf8(&decoded) {
                if let Some((username, raw_password)) = creds.split_once(':') {
                    let user_match = {
                        let mut db_lock = pool.database.lock().map_err(|_| actix_web::error::ErrorInternalServerError("Database lock poisoned"))?;
                        let conn = crate::model::database_initializer::connection(&mut db_lock);
                        
                        use crate::schema::ftt_users::dsl::*;
                        use diesel::prelude::*;
                        
                        ftt_users
                            .filter(id.eq(user_id))
                            .select(DbUser::as_select())
                            .first::<DbUser>(conn)
                            .optional()
                            .map_err(actix_web::error::ErrorInternalServerError)?
                    };
                    if let Some(user_info) = user_match {
                        if user_info.name == username {
                            let encoder = Argon2PasswordEncoder::new();
                            if encoder.matches(raw_password, &user_info.password) {
                                Some(user_info)
                            } else {
                                None
                            }
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
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

fn decode_hex(s: &str) -> Option<Vec<u8>> {
    if s.len() % 2 != 0 {
        return None;
    }
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).ok())
        .collect()
}
