//! The database layer: one module per table, plus connection and migration setup.
//!
//! Everything here speaks Diesel and hands back either a domain type from the
//! sibling modules or a `diesel::result::Error`. Nothing in here knows about HTTP.

pub(crate) mod database_initializer;
mod database_migrations;
pub mod games;

pub(crate) mod users;
pub(crate) mod discussions;
pub(crate) mod mails;
pub(crate) mod session;
pub(crate) mod achievements;

pub(crate) use database_initializer::DatabaseInitializer;


