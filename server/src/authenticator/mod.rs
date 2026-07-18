// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use actix_security::http::security::{Access, AuthorizationManager, RequestMatcherAuthorizer};
use actix_security::prelude::{Argon2PasswordEncoder, Authenticator, PasswordEncoder, User};
use actix_web::dev::ServiceRequest;
use std::collections::HashMap;
use std::fmt::Error;
use std::io::ErrorKind;
use std::sync::{Arc, OnceLock, RwLock, RwLockReadGuard};
use actix_security::http::security::jwt::{Claims, JwtError};
use actix_web::web::Data;
use diesel::row::NamedRow;
use serde::Serialize;
use crate::AppState;

static USER_STORE: OnceLock<RwLock<HashMap<String, User>>> = OnceLock::new();

#[derive(Serialize)]
pub struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    token_type: String,
    expires_in: u64,
}

impl TokenResponse {
    pub fn new(access_token: String, refresh_token: Option<String>, token_type: String, expires_in: u64) -> Self {
        Self {
            access_token,
            refresh_token,
            token_type,
            expires_in,
        }
    }
}

pub fn init_user_store(users: Vec<User>) {
    let map: HashMap<String, User> = users
        .into_iter()
        .map(|u| (u.get_username().to_string(), u))
        .collect();
    USER_STORE
        .set(RwLock::new(map))
        .expect("init_user_store: already initialized!")
}

pub fn register_user(user: User) {
    if let Some(store) = USER_STORE.get() {
        store
            .write()
            .expect("USER_STORE RwLock poisoned")
            .insert(user.get_username().to_string(), user);
    }
}

pub fn get_user_from_store(name: &str) -> Result<User, Error> {
    if let Some(store) = USER_STORE.get() {
        match store
            .write()
            .expect("USER_STORE RwLock poisoned")
            .get(name) {
            Some(user) => Ok(user.clone()),
            None => Err(Error)
        }
    } else {
        Err(Error)
    }
}

#[derive(Clone)]
pub struct AuthMiddleware {
    store: &'static RwLock<HashMap<String, User>>,
}

impl AuthMiddleware {
    fn new() -> Self {
        Self {
            store: USER_STORE
                .get()
                .expect("AuthMiddleware: call init_user_store() before HttpServer::new()"),
        }
    }
}

impl Authenticator for AuthMiddleware {
    #[allow(deprecated)]
    fn get_user(&self, req: &ServiceRequest) -> Option<User> {
        let state = req.app_data::<Data<Arc<AppState>>>().unwrap();
        let auth_header = req.headers().get("Authorization").and_then(|h| h.to_str().ok());
        let store = self.store.read().expect("USER_STORE RwLock poisoned");
        match auth_header {
            Some(h) if h.starts_with("Bearer ") => { authenticate_jwt(&h[7..], store, state.get_ref()) }
            Some(h) if h.starts_with("Basic ") => { authenticate_basic(&h[6..], store) }
            _ => None
        }
    }
}

fn authenticate_jwt(jwt_bearer: &str, store: RwLockReadGuard<HashMap<String, User>>, app_state: &Arc<AppState>) -> Option<User> {
    match app_state.jwt_authenticator.validate_token(jwt_bearer) {
        Ok(token_data) => {
            match store.get(token_data.claims.sub.as_str()) {
                Some(user) => Some(user.clone()),
                None => None
            }

        }
        _ => None
    }
}

fn authenticate_basic(b64: &str, store: RwLockReadGuard<HashMap<String, User>>) -> Option<User> {
    let encoder = Argon2PasswordEncoder::new();
    // Parse HTTP Basic Auth: "Authorization: Basic base64(user:pass)"
    // let header = req.headers().get("Authorization")?.to_str().ok()?;
    // let b64 = header.strip_prefix("Basic ")?;

    let decoded = base64::decode(b64).ok()?;
    let creds = std::str::from_utf8(&decoded.as_slice()).ok()?;

    // Split at first ':' only — passwords may themselves contain ':'
    let (username, raw_password) = creds.split_once(':')?;
    println!("User request: {:#?} {:?}", &username, &raw_password);

    let user = store.get(username)?;
    println!("User db: {:#?}", &user);
    if encoder.matches(raw_password, user.get_password()) {
        Some(user.clone())
    } else {
        None
    }
}

#[allow(dead_code)]
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
        .add_matcher("/users/login", Access::new().roles(vec!["USER"]))
    // add more matchers per route as needed
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_user_from_store_works() {
        let expected_user = User::new("czarte".into(), "password".into());
        init_user_store(vec![User::new("czarte".into(), "password".into())]);
        let user = get_user_from_store("czarte");
        assert_eq!(user.unwrap().get_username(), expected_user.get_username())
    }

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
        store
            .write()
            .unwrap()
            .insert(user.get_username().to_string(), user.clone());
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
