// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use diesel::prelude::*;

#[derive(Queryable, Selectable)]
#[diesel(table_name = crate::schema::ftt_token_blacklist)]
#[diesel(check_for_backend(diesel::pg::Pg))]
struct BlacklistedToken {
    #[allow(dead_code)]
    id: i32,
    token_key: String,
    #[allow(dead_code)]
    expires_at: i64,
}

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