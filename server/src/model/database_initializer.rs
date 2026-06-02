use diesel::prelude::*;
use dotenvy::{dotenv, dotenv_override};
use std::env;
use std::path::Path;

struct ServerEnvironment {
    database_url: String,
    database_pwd: String,
}

impl ServerEnvironment {
    fn new() -> ServerEnvironment {
        dotenv_override().expect("TODO: panic message for dotenv_override");
        Self {
            database_url: env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
            database_pwd: env::var("DATABASE_PASSWORD").expect("DATABASE_PWD must be set"),
        }
    }
}

pub struct DatabaseInitializer {
    database_url: String,
    pub(crate) database_connected: bool,
}

impl DatabaseInitializer {
    pub fn new() -> DatabaseInitializer {
        let environment = ServerEnvironment::new();
        DatabaseInitializer {
            database_url: environment.database_url,
            database_connected: false,
        }
    }

    pub fn connect(&mut self) {
        let _connection = PgConnection::establish(&self.database_url.as_str())
            .unwrap_or_else(|_| panic!("Error connecting to {}", self.database_url));
        self.database_connected = true;
    }
}
