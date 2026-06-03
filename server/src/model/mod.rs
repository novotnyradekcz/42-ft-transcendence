// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

pub(crate) mod database_initializer;
mod database_migrations;
pub mod user_handler;

use database_initializer::DatabaseInitializer;

pub fn inittialize_db() -> DatabaseInitializer {
    let mut dbinitializer = DatabaseInitializer::new();
    dbinitializer.connect();
    dbinitializer
}

mod test {
    use super::*;

    #[test]
    fn initialize_db_work() {
        let db = inittialize_db();
        assert_eq!(db.database_connected, true)
    }
}
