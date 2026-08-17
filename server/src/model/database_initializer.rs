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

/// The parts of a provider that don't vary by deployment.
/// A fourth one is an entry here plus a branch in parse_profile.
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
    // no username, and its id is the string `sub` — see parse_profile
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
    /// Built from OAUTH_REDIRECT_BASE — the path is fixed by the route, so
    /// only the origin varies. Providers reject anything that isn't a byte-for
    /// -byte match with what you registered, so one variable beats three.
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

        // defaults to what the compose stack serves locally
        let redirect_base = env::var("OAUTH_REDIRECT_BASE")
            .ok()
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "https://localhost".to_string());
        let redirect_base = redirect_base.trim_end_matches('/').to_string();

        let providers = PROVIDER_SPECS
            .iter()
            .map(|spec| {
                // 42 -> OAUTH_42_*, google -> OAUTH_GOOGLE_*
                let prefix = format!("OAUTH_{}", spec.id.to_uppercase());
                OAuthProvider {
                    spec,
                    // never .expect() — an unconfigured provider is just not
                    // offered, and shouldn't stop the server booting
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

    /// Configured ones only, so callers needn't re-check.
    pub fn configured(&self, id: &str) -> Option<&OAuthProvider> {
        self.providers
            .iter()
            .find(|p| p.spec.id == id && p.is_configured())
    }

    pub fn all_configured(&self) -> impl Iterator<Item = &OAuthProvider> {
        self.providers.iter().filter(|p| p.is_configured())
    }

    /// Same origin as the redirect URIs, so the two can't drift apart.
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
