// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

//! The `ftt_token_blacklist` table — the insert half of it.
//!
//! Revoked tokens are written here so a restart doesn't quietly hand every
//! logged-out token its access back. Reads live in
//! `session::load_valid_blacklisted_tokens`.

use diesel::prelude::*;

// Reads of the blacklist table go through `session::load_valid_blacklisted_tokens`,
// which selects `token_key` directly into a `String` — so there is no Queryable
// row struct here, only the insert shape.
#[derive(Insertable)]
#[diesel(table_name = crate::schema::ftt_token_blacklist)]
pub struct NewBlacklistedToken {
    token_key: String,
    expires_at: i64,
}

impl NewBlacklistedToken {
    pub fn new(token_key: String, expires_at: i64) -> Self {
        Self {
            token_key,
            expires_at
        }
    }
}