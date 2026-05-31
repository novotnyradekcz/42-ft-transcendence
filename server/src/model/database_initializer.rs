use std::path::Path;
use diesel::prelude::*;
use dotenvy::dotenv;
use std::env;

struct DatabaseInitializer {
    database_url: Path,
    database_connected: bool,
}