// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use actix_security::http::security::{Access, AuthenticationManager, AuthorizationManager, MemoryAuthenticator, RequestMatcherAuthorizer};
use actix_security::prelude::{Argon2PasswordEncoder, PasswordEncoder, User};
use actix_web::{web, FromRequest, HttpRequest};
use actix_web::dev::Payload;

struct AuthMiddleware;

pub fn create_authenticator() -> MemoryAuthenticator {
    let encoder = Argon2PasswordEncoder::new();
    AuthenticationManager::in_memory_authentication()
        .password_encoder(encoder.clone())
        .with_user(
            User::with_encoded_password("admin", encoder.encode("admin"))
                .roles(&["ADMIN".into(), "USER".into()])
                .authorities(&["posts:write".into()])
        )
}

// Factory function: URL-based authorization rules
pub fn create_authorizer() -> RequestMatcherAuthorizer {
    AuthorizationManager::request_matcher()
        .http_basic()
        .add_matcher("/users/login", Access::new().roles(vec!["ADMIN"]))
    // add more matchers per route as needed
}