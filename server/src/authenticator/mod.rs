// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use std::collections::HashMap;
use std::sync::{OnceLock, RwLock};
use actix_security::http::security::{Access, AuthorizationManager, RequestMatcherAuthorizer};
use actix_security::prelude::{Argon2PasswordEncoder, Authenticator, PasswordEncoder, User};
use actix_web::dev::{ServiceRequest};
use crate::AppState;

static USER_STORE: OnceLock<RwLock<HashMap<String, User>>> = OnceLock::new();

pub fn init_user_store(users: Vec<User>) {
    let map: HashMap<String, User> = users
        .into_iter()
        .map(|u| (u.get_username().to_string(), u))
        .collect();
    USER_STORE.set(RwLock::new(map)).expect("init_user_store: already initialized!")
}

pub fn register_user(user: User) {
    if let Some(store) = USER_STORE.get() {
        store.write().expect("USER_STORE RwLock poisoned").insert(user.get_username().to_string(), user);
    }
}

#[derive(Clone)]
pub struct AuthMiddleware {
    store: &'static RwLock<HashMap<String, User>>,
}

impl AuthMiddleware {
    fn new() -> Self {
        Self {
            store: USER_STORE.get().expect("AuthMiddleware: call init_user_store() before HttpServer::new()"),
        }
    }
}

impl Authenticator for AuthMiddleware {
    fn get_user(&self, req: &ServiceRequest) -> Option<User> {
        let encoder = Argon2PasswordEncoder::new();
        // Parse HTTP Basic Auth: "Authorization: Basic base64(user:pass)"
        let header = req.headers().get("Authorization")?.to_str().ok()?;
        let b64 = header.strip_prefix("Basic ")?;

        let decoded = base64::decode(b64).ok()?;
        let creds = std::str::from_utf8(&decoded.as_slice()).ok()?;


        // Split at first ':' only — passwords may themselves contain ':'
        let (username, raw_password) = creds.split_once(':')?;
        println!("User request: {:#?} {:?}", &username, &raw_password);
        let store = self.store.read().expect("USER_STORE RwLock poisoned");
        let user = store.get(username)?;
        println!("User db: {:#?}", &user);
        if encoder.matches(raw_password, user.get_password()) {
            Some(user.clone())
        } else {
            None
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
struct LoginFromMiddleware {
    username: String,
    password: String,
}

pub fn create_authenticator() -> AuthMiddleware {
    AuthMiddleware::new()
}

// Factory function: URL-based authorization rules
pub fn create_authorizer() -> RequestMatcherAuthorizer {
    AuthorizationManager::request_matcher()
        .http_basic()
        .add_matcher("/users/login", Access::new().roles(vec!["ADMIN"]))
    // add more matchers per route as needed
}

#[cfg(test)]
mod tests {
    use super::*;

    fn alice() -> User {
        let enc = Argon2PasswordEncoder::new();
        User::with_encoded_password("alice", enc.encode("s3cr3t")).roles(&["USER".into()])
    }

    // Happy path: registered user is found in the store
    #[test]
    fn register_and_lookup_user() {
        // Use a fresh map to avoid OnceLock collision across tests
        let store: RwLock<HashMap<String, User>> = RwLock::new(HashMap::new());
        let user = alice();
        store.write().unwrap().insert(user.get_username().to_string(), user.clone());
        assert!(store.read().unwrap().contains_key("alice"));
    }

    // Edge case: unknown username returns None
    #[test]
    fn unknown_user_not_found() {
        let store: RwLock<HashMap<String, User>> = RwLock::new(HashMap::new());
        assert!(store.read().unwrap().get("bob").is_none());
    }

    // Edge case: wrong password fails matches()
    #[test]
    fn wrong_password_rejected() {
        let enc = Argon2PasswordEncoder::new();
        let hash = enc.encode("correct");
        assert!(!enc.matches("wrong", &hash.as_str()));
    }

    // Happy path: correct password passes matches()
    #[test]
    fn correct_password_accepted() {
        let enc = Argon2PasswordEncoder::new();
        let hash = enc.encode("correct");
        assert!(enc.matches("correct", &hash.as_str()));
    }
}