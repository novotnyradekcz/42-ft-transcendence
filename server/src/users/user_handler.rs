// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use std::sync::Mutex;
use actix_web::web::Json;
use crate::model::database_initializer::DatabaseInitializer;
use crate::users::{CreateUser, UserInfo};
use diesel::prelude::*;
use diesel::result::Error;
use actix_security::prelude::{Argon2PasswordEncoder, PasswordEncoder};
use actix_web::web;
use crate::model::database_initializer::connection;
use crate::model::users::DbUser;

pub enum CreateUserError {
    /// A user with the same name or email already exists
    AlreadyExists,
    /// An unexpected database error occurred
    DatabaseError(diesel::result::Error),
}

impl From<Error> for CreateUserError {
    fn from(e: Error) -> Self {
        CreateUserError::DatabaseError(e)
    }
}

fn public_user(user: DbUser) -> UserInfo {
    UserInfo {
        id: user.id,
        name: user.name,
        email: user.email,
        bio: "No profile info yet.".to_string(),
        avatar_url: "/images/profile.png".to_string(),
        status: "offline".to_string(),
    }
}

pub fn seed_users_in_db(db: &mut DatabaseInitializer) -> Result<(), diesel::result::Error> {
    use crate::model::users::NewUser;
    use crate::schema::ftt_users::dsl::*;

    let conn = connection(db);
    let seed_users = [
        ("test", "test@example.local", "test"),
        ("admin", "admin@example.local", "admin"),
        ("guest", "guest@example.local", "guest"),
    ];

    for (seed_name, seed_email, seed_password) in seed_users {
        let existing = ftt_users
            .filter(name.eq(seed_name).or(email.eq(seed_email)))
            .select(id)
            .first::<i32>(conn)
            .optional()?;

        if existing.is_none() {
            diesel::insert_into(ftt_users)
                .values(&NewUser::create( seed_name, seed_email, seed_password))
                .execute(conn)?;
        }
    }

    Ok(())
}

pub fn get_user_from_db_by_name(db: &mut DatabaseInitializer, user_name: String) -> Option<DbUser> {
    use crate::schema::ftt_users::dsl::*;

    let conn = db
        .connection
        .as_mut()
        .expect("Database connection is not established");

    // Reject if name or email is already taken
    ftt_users
        .filter(name.eq(&user_name))
        .select(DbUser::as_select())
        .first(conn)
        .optional().ok()?
}

pub fn list_users_in_db(
    conn: &mut PgConnection,
) -> Result<Vec<UserInfo>, diesel::result::Error> {
    use crate::schema::ftt_users::dsl::*;

    let rows = ftt_users
        .order(id.asc())
        .select(DbUser::as_select())
        .load(conn)?;

    Ok(rows.into_iter().map(public_user).collect())
}

pub fn get_all_users_from_db(pool: &web::Data<Mutex<DatabaseInitializer>>) -> Option<Vec<DbUser>> {
    use crate::schema::ftt_users::dsl::*;

    let mut db = pool.lock().expect("create_user expect DatabaseInitializer");
    let conn = db
        .connection
        .as_mut()
        .expect("create_user_in_db: Database connection is not established");


    // Reject if name or email is already taken
    ftt_users
        .select(DbUser::as_select())
        .load(conn)
        .optional().ok()?
}

pub fn get_user_from_db_by_name_or_email(conn: &mut PgConnection, user_name: &String, user_email: &String)
    -> Option<DbUser> {
    use crate::schema::ftt_users::dsl::*;

    // Reject if name or email is already taken
    ftt_users
        .filter(name.eq(user_name).or(email.eq(user_email)))
        .select(DbUser::as_select())
        .first(conn)
        .optional().ok()?
}

pub fn get_user_in_db(
    db: &mut DatabaseInitializer,
    user_id: i32,
) -> Result<Option<UserInfo>, diesel::result::Error> {
    use crate::schema::ftt_users::dsl::*;

    let user = ftt_users
        .filter(id.eq(user_id))
        .select(DbUser::as_select())
        .first::<DbUser>(connection(db))
        .optional()?;

    Ok(user.map(public_user))
}

/// Creates a new user in ftt_users if no existing row shares the same name or email.
/// Returns the created user's info on success, or a `CreateUserError` on failure.
pub fn create_user_in_db(
    db: &mut DatabaseInitializer,
    new_user: &Json<CreateUser>,
    encoder: &Argon2PasswordEncoder,
) -> Result<UserInfo, CreateUserError> {
    use crate::model::users::NewUser;
    use crate::schema::ftt_users::dsl::*;

    let conn = connection(db);

    // Reject if name or email is already taken
    let existing = get_user_from_db_by_name_or_email(conn, &new_user.name, &new_user.email);

    if existing.is_some() {
        return Err(CreateUserError::AlreadyExists);
    }

    let encoded_password = encoder.encode(&new_user.password);
    // Insert and return the newly created row
    let inserted: DbUser = diesel::insert_into(ftt_users)
        .values(&NewUser::create(&new_user.name.as_str(), &new_user.email.as_str(), &encoded_password.as_str()))
        .returning(DbUser::as_returning())
        .get_result(conn)?;

    Ok(public_user(inserted))
}

#[cfg(test)]
mod tests {
    use actix_security::prelude::{Argon2PasswordEncoder, PasswordEncoder};

    /// Happy path: encoded output is not equal to the raw plaintext.
    #[test]
    fn argon2_encode_does_not_return_plaintext() {
        let encoder = Argon2PasswordEncoder::new();
        let raw = "supersecret";
        let encoded = encoder.encode(raw);
        assert_ne!(raw, encoded, "encoded password must not equal the raw password");
    }

    /// Happy path: encoded password verifies correctly against the raw password.
    #[test]
    fn argon2_encoded_password_matches_raw() {
        let encoder = Argon2PasswordEncoder::new();
        let raw = "supersecret";
        let encoded = encoder.encode(raw);
        assert!(
            encoder.matches(raw, &encoded.as_str()),
            "encoder.matches() must return true for the correct raw password"
        );
    }

    /// Edge case: wrong password does NOT match the stored hash.
    #[test]
    fn argon2_wrong_password_does_not_match() {
        let encoder = Argon2PasswordEncoder::new();
        let encoded = encoder.encode("correct_password");
        assert!(
            !encoder.matches("wrong_password", &encoded.as_str()),
            "encoder.matches() must return false for an incorrect password"
        );
    }

    /// Edge case: empty string encodes and round-trips correctly.
    #[test]
    fn argon2_empty_password_encodes_and_matches() {
        let encoder = Argon2PasswordEncoder::new();
        let encoded = encoder.encode("");
        assert!(encoder.matches("", &encoded.as_str()));
        assert!(!encoder.matches("notempty", &encoded.as_str()));
    }
}

