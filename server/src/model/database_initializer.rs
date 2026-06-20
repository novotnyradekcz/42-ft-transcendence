// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use super::database_migrations::run_migrations;
use diesel::prelude::*;
use dotenvy::dotenv_override;
use dotenvy::dotenv;
use std::env;

struct ServerEnvironment {
    database_url: String,
}

impl ServerEnvironment {
    fn new() -> ServerEnvironment {
        dotenv_override().expect("TODO: panic message for dotenv_override");
        dotenv().ok();
        Self {
            database_url: env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
        }
    }
}

pub struct DatabaseInitializer {
    database_url: String,
    pub(crate) database_connected: bool,
    pub(crate) connection: Option<PgConnection>,
}

impl DatabaseInitializer {
    pub fn new() -> DatabaseInitializer {
        let environment = ServerEnvironment::new();
        DatabaseInitializer {
            database_url: environment.database_url,
            database_connected: false,
            connection: None,
        }
    }

    pub fn connect(&mut self) {
        let mut connection = PgConnection::establish(self.database_url.as_str())
            .unwrap_or_else(|_| panic!("Error connecting to {}", self.database_url));
        run_migrations(&mut connection);
        self.database_connected = true;
        self.connection = Some(connection);
    }
}
