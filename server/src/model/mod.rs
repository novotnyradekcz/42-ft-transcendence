pub(crate) mod database_initializer;
mod database_migrations;
pub mod games;

pub(crate) mod users;
pub(crate) mod discussions;
pub(crate) mod mails;
pub(crate) use database_initializer::DatabaseInitializer;
use users::seed_users_in_db;
use games::seed_games_in_db;

pub fn inittialize_db() -> DatabaseInitializer {
    let mut dbinitializer = DatabaseInitializer::new();
    dbinitializer.connect();
    seed_users_in_db(&mut dbinitializer).expect("Failed to seed database users");
    seed_games_in_db(&mut dbinitializer).expect("Failed to seed database games");
    dbinitializer
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn initialize_db_work() {
        let db = inittialize_db();
        assert_eq!(db.database_connected, true)
    }
}

