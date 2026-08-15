// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use super::database_migrations::run_migrations;
use diesel::prelude::*;
use dotenvy::dotenv;
use std::env;
use crate::model::users::seed_users_in_db;
use crate::model::games::seed_games_in_db;

#[allow(dead_code)]
pub struct ServerEnvironment {
    database_url: String,
    pass_hash: String,
    jwt_hash: String,
}

impl ServerEnvironment {
    pub fn get_jwt_hash(&self) -> String {
        self.jwt_hash.clone()
    }

    pub fn get_pass_hash(&self) -> String {
        self.pass_hash.clone()
    }
}

impl ServerEnvironment {
    fn new() -> ServerEnvironment {
        dotenv().ok();
        Self {
            database_url: env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
            pass_hash: env::var("SECRET_HASH").expect("SECRET_HASH must be set"),
            jwt_hash: env::var("JWT_HASH").expect("JWT_HASH must be set"),
        }
    }
}

pub struct DatabaseInitializer {
    pub(crate) connection: Option<PgConnection>,
    pub(crate) database_connected: bool,
    pub(crate) server_environment: ServerEnvironment,
}

impl DatabaseInitializer {
    pub fn new() -> DatabaseInitializer {
        let environment = ServerEnvironment::new();
        DatabaseInitializer {
            connection: None,
            database_connected: false,
            server_environment: environment,
        }
    }

    pub fn connect(&mut self) {
        let mut connection = PgConnection::establish(self.server_environment.database_url.as_str())
            .unwrap_or_else(|e| panic!("Error: Database does not probably running, Can't connect to {} due error: {}", self.server_environment.database_url, e));
        run_migrations(&mut connection);
        self.database_connected = true;
        self.connection = Some(connection);
    }
}

/// Everything about a provider that does not depend on deployment: the URLs
/// and the scope. Adding a fourth provider is one more entry in PROVIDER_SPECS
/// plus a branch in the profile parser — nothing else in the codebase changes.
pub struct ProviderSpec {
    pub id: &'static str,
    pub label: &'static str,
    pub authorize_url: &'static str,
    pub token_url: &'static str,
    pub profile_url: &'static str,
    pub scope: &'static str,
}

pub const PROVIDER_SPECS: &[ProviderSpec] = &[
    ProviderSpec {
        id: "42",
        label: "42 Intra",
        authorize_url: "https://api.intra.42.fr/oauth/authorize",
        token_url: "https://api.intra.42.fr/oauth/token",
        profile_url: "https://api.intra.42.fr/v2/me",
        scope: "public",
    },
    // UNVERIFIED against the real service — written from Google's documented
    // endpoints but never exercised, because nobody on the team had a Google
    // account to register a client with. It costs nothing to leave here: with
    // no OAUTH_GOOGLE_* credentials it is filtered out of the menu entirely
    // and /auth/google answers 503. Whoever first configures it should expect
    // to debug it, and should delete this comment once a login has worked.
    ProviderSpec {
        id: "google",
        label: "Google",
        authorize_url: "https://accounts.google.com/o/oauth2/v2/auth",
        token_url: "https://oauth2.googleapis.com/token",
        profile_url: "https://www.googleapis.com/oauth2/v3/userinfo",
        scope: "openid email profile",
    },
    ProviderSpec {
        id: "github",
        label: "GitHub",
        authorize_url: "https://github.com/login/oauth/authorize",
        token_url: "https://github.com/login/oauth/access_token",
        profile_url: "https://api.github.com/user",
        scope: "read:user user:email",
    },
];

pub struct OAuthProvider {
    pub spec: &'static ProviderSpec,
    pub client_id: String,
    pub client_secret: String,
    /// Derived from OAUTH_REDIRECT_BASE rather than configured per provider:
    /// the path is fixed by the route, so the only free part is the origin.
    /// One variable to get wrong instead of one per provider — and every
    /// provider rejects the request outright if it does not match byte for
    /// byte what was registered with them.
    pub redirect_uri: String,
}

impl OAuthProvider {
    pub fn is_configured(&self) -> bool {
        !self.client_id.is_empty() && !self.client_secret.is_empty()
    }
}

pub struct OAuthConfig {
    providers: Vec<OAuthProvider>,
    redirect_base: String,
}

impl OAuthConfig {
    pub fn from_env() -> Self {
        dotenv().ok();

        // Where the browser comes back to. Defaults to the local HTTPS origin
        // the compose stack serves, so a developer only sets this to deploy
        // somewhere else.
        let redirect_base = env::var("OAUTH_REDIRECT_BASE")
            .ok()
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "https://localhost".to_string());
        let redirect_base = redirect_base.trim_end_matches('/').to_string();

        let providers = PROVIDER_SPECS
            .iter()
            .map(|spec| {
                // 42 -> OAUTH_42_*, google -> OAUTH_GOOGLE_*, and so on.
                let prefix = format!("OAUTH_{}", spec.id.to_uppercase());
                OAuthProvider {
                    spec,
                    // Never .expect(): a deployment configures the providers it
                    // has credentials for, and the rest are simply not offered.
                    // Panicking here would stop the server booting for everyone
                    // who has not registered an app with all three.
                    client_id: env::var(format!("{prefix}_CLIENT_ID"))
                        .ok()
                        .unwrap_or_default(),
                    client_secret: env::var(format!("{prefix}_CLIENT_SECRET"))
                        .ok()
                        .unwrap_or_default(),
                    redirect_uri: format!(
                        "{redirect_base}/api/auth/{}/callback",
                        spec.id
                    ),
                }
            })
            .collect();

        Self {
            providers,
            redirect_base,
        }
    }

    /// Only returns a provider this deployment can actually complete a login
    /// with, so callers never have to re-check `is_configured`.
    pub fn configured(&self, id: &str) -> Option<&OAuthProvider> {
        self.providers
            .iter()
            .find(|p| p.spec.id == id && p.is_configured())
    }

    pub fn all_configured(&self) -> impl Iterator<Item = &OAuthProvider> {
        self.providers.iter().filter(|p| p.is_configured())
    }

    /// Where to send the browser once a session exists. Shares its origin with
    /// the redirect URIs by construction, so the two cannot drift apart.
    pub fn after_login_url(&self) -> String {
        format!("{}/menu", self.redirect_base)
    }
}

pub fn initialize_db() -> DatabaseInitializer {
    let mut dbinitializer = DatabaseInitializer::new();
    dbinitializer.connect();
    seed_users_in_db(&mut dbinitializer).expect("Failed to seed database users");
    seed_games_in_db(&mut dbinitializer).expect("Failed to seed database games");
    dbinitializer
}

pub fn connection(db: &mut DatabaseInitializer) -> &mut PgConnection {
    db.connection
        .as_mut()
        .expect("Database connection is not established")
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn initialize_db_work() {
        let db = initialize_db();
        assert_eq!(db.database_connected, true)
    }
}
