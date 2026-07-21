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
