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

pub struct OAuth42Config {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

impl OAuth42Config {
    pub fn from_env() -> Self {
        dotenv().ok();
        Self {
            client_id:
                env::var("OAUTH42_CLIENT_ID").ok().unwrap_or_default(),
            client_secret: 
                env::var("OAUTH42_CLIENT_SECRET").ok().unwrap_or_default(),
            redirect_uri:
                env::var("OAUTH42_REDIRECT_URI").ok().unwrap_or_default(),
        }
    }

    pub fn is_configured(&self) -> bool {
        !self.client_id.is_empty()
            && !self.client_secret.is_empty()
            && !self.redirect_uri.is_empty()
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
