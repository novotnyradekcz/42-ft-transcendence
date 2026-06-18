// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use crate::model::database_initializer::DatabaseInitializer;
use diesel::prelude::*;

pub fn seed_games_in_db(db: &mut DatabaseInitializer) -> Result<(), diesel::result::Error> {
    use crate::schema::ftt_games::dsl::*;
    use crate::schema::ftt_users::dsl as users_dsl;

    let conn = db
        .connection
        .as_mut()
        .expect("Database connection is not established");

    // Check if any games are already present
    let existing_count = ftt_games.count().get_result::<i64>(conn)?;
    if existing_count > 0 {
        return Ok(());
    }

    // Find the admin user ID to set as author
    let admin_id = users_dsl::ftt_users
        .filter(users_dsl::name.eq("admin"))
        .select(users_dsl::id)
        .first::<i32>(conn)
        .optional()?
        .unwrap_or(2); // fallback to ID 2 (which is admin's ID)

    let tic_tac_toe_lua = include_str!("tic_tac_toe.lua");

    diesel::insert_into(ftt_games)
        .values((
            author.eq(admin_id),
            name.eq("Tic-Tac-Toe"),
            body.eq(tic_tac_toe_lua),
        ))
        .execute(conn)?;

    Ok(())
}
