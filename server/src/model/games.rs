// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use crate::model::database_initializer::{DatabaseInitializer, connection};
use crate::games::GameInfo;
use diesel::prelude::*;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct CreateGame {
    pub name: String,
    pub author: i32,
    pub lua_code: String,
}

pub fn list_games_in_db(
    db: &mut DatabaseInitializer,
) -> Result<Vec<GameInfo>, diesel::result::Error> {
    use crate::schema::ftt_games::dsl as games;

    let conn = connection(db);
    games::ftt_games
        .order(games::id.asc())
        .select(GameInfo::as_select())
        .load::<GameInfo>(conn)
}

pub fn get_game_in_db(
    db: &mut DatabaseInitializer,
    game_id: i32,
) -> Result<Option<GameInfo>, diesel::result::Error> {
    use crate::schema::ftt_games::dsl as games;

    let conn = connection(db);
    games::ftt_games
        .filter(games::id.eq(game_id))
        .select(GameInfo::as_select())
        .first::<GameInfo>(conn)
        .optional()
}

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

    let games_dir = std::env::var("GAMES_DIR").unwrap_or_else(|_| "../frontend/public/games".to_string());
    if let Err(err) = std::fs::create_dir_all(&games_dir) {
        eprintln!("Failed to create games directory during seeding: {:?}", err);
    }

    let tic_tac_toe_filename = "tic_tac_toe.lua";
    let file_path = std::path::Path::new(&games_dir).join(tic_tac_toe_filename);
    let tic_tac_toe_lua = include_str!("tic_tac_toe.lua");
    if let Err(err) = std::fs::write(&file_path, tic_tac_toe_lua) {
        eprintln!("Failed to write seed tic-tac-toe game: {:?}", err);
    }

    let game_link = "/games/tic_tac_toe.lua";

    diesel::insert_into(ftt_games)
        .values((
            author.eq(admin_id),
            name.eq("Tic-Tac-Toe"),
            body.eq(game_link),
        ))
        .execute(conn)?;

    Ok(())
}
