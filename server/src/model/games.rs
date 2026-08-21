// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

//! The `ftt_games` and `ftt_game_history` tables: stored Lua scripts, finished
//! matches, and the leaderboard.
//!
//! A game *is* its Lua source, kept in a TEXT column. The server only stores it
//! and hands it to both players — running it is the browser's job, so nothing
//! here parses or trusts it.
//!
//! The leaderboard is raw SQL rather than the Diesel DSL because it has to count
//! each match twice, once from each player's side, before it can total anything.

use crate::games::GameInfo;
use crate::model::database_initializer::{connection, DatabaseInitializer};
use diesel::prelude::*;

// installs the bundled Tic-Tac-Toe, updating it in place if it's already there,
// so an edited script ships on the next boot instead of inserting a duplicate
pub fn seed_games_in_db(db: &mut DatabaseInitializer) -> Result<(), diesel::result::Error> {
    use crate::schema::ftt_games::dsl::*;
    use crate::schema::ftt_users::dsl as users_dsl;

    let conn = db
        .connection
        .as_mut()
        .expect("Database connection is not established");

    // Find the admin user ID to set as author
    let admin_id = users_dsl::ftt_users
        .filter(users_dsl::name.eq("admin"))
        .select(users_dsl::id)
        .first::<i32>(conn)
        .optional()?
        .unwrap_or(2); // fallback to ID 2 (which is admin's ID)

    let tic_tac_toe_lua = include_str!("../games/scripts/tic_tac_toe.lua");
    let battleship_lua = include_str!("../games/scripts/battleship.lua");

    // Check if Tic-Tac-Toe game already exists
    let existing_ttt_id = ftt_games
        .filter(name.eq("Tic-Tac-Toe"))
        .select(id)
        .first::<i32>(conn)
        .optional()?;

    if let Some(existing_id) = existing_ttt_id {
        diesel::update(ftt_games.filter(id.eq(existing_id)))
            .set((
                author.eq(admin_id),
                body.eq(tic_tac_toe_lua),
            ))
            .execute(conn)?;
    } else {
        diesel::insert_into(ftt_games)
            .values((
                author.eq(admin_id),
                name.eq("Tic-Tac-Toe"),
                body.eq(tic_tac_toe_lua),
            ))
            .execute(conn)?;
    }

    // Check if Battleship game already exists
    let existing_bs_id = ftt_games
        .filter(name.eq("Battleship"))
        .select(id)
        .first::<i32>(conn)
        .optional()?;

    if let Some(existing_id) = existing_bs_id {
        diesel::update(ftt_games.filter(id.eq(existing_id)))
            .set((
                author.eq(admin_id),
                body.eq(battleship_lua),
            ))
            .execute(conn)?;
    } else {
        diesel::insert_into(ftt_games)
            .values((
                author.eq(admin_id),
                name.eq("Battleship"),
                body.eq(battleship_lua),
            ))
            .execute(conn)?;
    }

    Ok(())
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

#[derive(Insertable)]
#[diesel(table_name = crate::schema::ftt_games)]
pub struct NewGame<'a> {
    pub author: i32,
    pub name: &'a str,
    pub body: &'a str,
}

pub fn create_game_in_db(
    db: &mut DatabaseInitializer,
    author_id: i32,
    name: &str,
    body: &str,
) -> Result<GameInfo, diesel::result::Error> {
    use crate::schema::ftt_games::dsl as games;

    let conn = connection(db);
    diesel::insert_into(games::ftt_games)
        .values(&NewGame {
            author: author_id,
            name,
            body,
        })
        .returning(GameInfo::as_returning())
        .get_result::<GameInfo>(conn)
}

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Queryable, Selectable, Debug, Clone)]
#[diesel(table_name = crate::schema::ftt_game_history)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct DbGameHistoryRecord {
    pub id: i32,
    pub game_id: i32,
    pub game_name: String,
    pub player1_id: i32,
    pub player2_id: i32,
    pub winner_id: Option<i32>,
    pub played_at: std::time::SystemTime,
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::ftt_game_history)]
pub struct NewGameHistoryRecord<'a> {
    pub game_id: i32,
    pub game_name: &'a str,
    pub player1_id: i32,
    pub player2_id: i32,
    pub winner_id: Option<i32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GameHistoryResponse {
    pub id: i32,
    pub game_id: i32,
    pub game_name: String,
    pub player1_id: i32,
    pub player1_name: String,
    pub player2_id: i32,
    pub player2_name: String,
    pub winner_id: Option<i32>,
    pub winner_name: Option<String>,
    pub played_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LeaderboardEntry {
    pub rank: i32,
    pub user_id: i32,
    pub user_name: String,
    pub wins: i32,
    pub losses: i32,
    pub draws: i32,
    pub win_loss_ratio: f64,
    pub latest_achievements: Vec<String>,
}

pub fn save_game_history_in_db(
    db: &mut DatabaseInitializer,
    game_id: i32,
    game_name: &str,
    player1_id: i32,
    player2_id: i32,
    winner_id: Option<i32>,
) -> Result<DbGameHistoryRecord, diesel::result::Error> {
    use crate::schema::ftt_game_history::dsl as gh;

    let conn = connection(db);
    diesel::insert_into(gh::ftt_game_history)
        .values(&NewGameHistoryRecord {
            game_id,
            game_name,
            player1_id,
            player2_id,
            winner_id,
        })
        .returning(DbGameHistoryRecord::as_returning())
        .get_result::<DbGameHistoryRecord>(conn)
}

use chrono::{DateTime, Utc};

// every match the user played, newest first. names are joined in here so the
// client needs no user list to render a row
pub fn get_game_history_for_user_in_db(
    db: &mut DatabaseInitializer,
    user_id: i32,
) -> Result<Vec<GameHistoryResponse>, diesel::result::Error> {
    use crate::schema::ftt_game_history::dsl as gh;
    use crate::schema::ftt_users::dsl as users;

    let conn = connection(db);
    let records = gh::ftt_game_history
        .filter(gh::player1_id.eq(user_id).or(gh::player2_id.eq(user_id)))
        .order(gh::played_at.desc())
        .select(DbGameHistoryRecord::as_select())
        .load::<DbGameHistoryRecord>(conn)?;

    let all_users = users::ftt_users
        .select((users::id, users::name))
        .load::<(i32, String)>(conn)?;
    let user_map: std::collections::HashMap<i32, String> = all_users.into_iter().collect();

    let result = records
        .into_iter()
        .map(|r| {
            let p1_name = user_map.get(&r.player1_id).cloned().unwrap_or_else(|| format!("User #{}", r.player1_id));
            let p2_name = user_map.get(&r.player2_id).cloned().unwrap_or_else(|| format!("User #{}", r.player2_id));
            let w_name = r.winner_id.and_then(|id| user_map.get(&id).cloned());

            GameHistoryResponse {
                id: r.id,
                game_id: r.game_id,
                game_name: r.game_name,
                player1_id: r.player1_id,
                player1_name: p1_name,
                player2_id: r.player2_id,
                player2_name: p2_name,
                winner_id: r.winner_id,
                winner_name: w_name,
                played_at: DateTime::<Utc>::from(r.played_at).format("%Y-%m-%d %H:%M").to_string(),
            }
        })
        .collect();

    Ok(result)
}

// raw SQL: a match stores one row with two players, so the standings need it
// unpacked into one row per player before anything can be grouped. that's the
// UNION ALL below, and it doesn't express well in the Diesel DSL
#[derive(QueryableByName, Debug)]
struct RawLeaderboardRow {
    #[diesel(sql_type = diesel::sql_types::Integer)]
    pub user_id: i32,
    #[diesel(sql_type = diesel::sql_types::Text)]
    pub user_name: String,
    #[diesel(sql_type = diesel::sql_types::Integer)]
    pub wins: i32,
    #[diesel(sql_type = diesel::sql_types::Integer)]
    pub losses: i32,
    #[diesel(sql_type = diesel::sql_types::Integer)]
    pub draws: i32,
    #[diesel(sql_type = diesel::sql_types::Double)]
    pub win_loss_ratio: f64,
}

// top ten by win ratio, ranked here rather than in SQL so rank is 1-based and
// contiguous even when the query ties
pub fn get_leaderboard_in_db(
    db: &mut DatabaseInitializer,
) -> Result<Vec<LeaderboardEntry>, diesel::result::Error> {
    use crate::schema::ftt_achievements::dsl as achievements;
    use crate::schema::ftt_player_achievements::dsl as player_achievements;

    let conn = connection(db);

    let sql = "
        WITH player_outcomes AS (
            SELECT
                player1_id AS user_id,
                CASE WHEN winner_id = player1_id THEN 1 ELSE 0 END AS win,
                CASE WHEN winner_id IS NOT NULL AND winner_id != player1_id THEN 1 ELSE 0 END AS loss,
                CASE WHEN winner_id IS NULL THEN 1 ELSE 0 END AS draw
            FROM ftt_game_history
            UNION ALL
            SELECT
                player2_id AS user_id,
                CASE WHEN winner_id = player2_id THEN 1 ELSE 0 END AS win,
                CASE WHEN winner_id IS NOT NULL AND winner_id != player2_id THEN 1 ELSE 0 END AS loss,
                CASE WHEN winner_id IS NULL THEN 1 ELSE 0 END AS draw
            FROM ftt_game_history
        ),
        player_stats AS (
            SELECT
                user_id,
                SUM(win)::INT AS wins,
                SUM(loss)::INT AS losses,
                SUM(draw)::INT AS draws,
                CASE
                    WHEN SUM(win) + SUM(loss) = 0 THEN 0::FLOAT8
                    ELSE ROUND(SUM(win)::NUMERIC / (SUM(win) + SUM(loss))::NUMERIC, 4)::FLOAT8
                END AS win_loss_ratio
            FROM player_outcomes
            GROUP BY user_id
        )
        SELECT
            u.id AS user_id,
            u.name AS user_name,
            s.wins,
            s.losses,
            s.draws,
            s.win_loss_ratio
        FROM player_stats s
        JOIN ftt_users u ON u.id = s.user_id
        ORDER BY s.win_loss_ratio DESC, s.wins DESC
        LIMIT 10;
    ";

    let rows = diesel::sql_query(sql).load::<RawLeaderboardRow>(conn)?;

    let user_ids: Vec<i32> = rows.iter().map(|r| r.user_id).collect();

    let mut emoji_map: std::collections::HashMap<i32, Vec<String>> = std::collections::HashMap::new();
    if !user_ids.is_empty() {
        let player_emojis: Vec<(i32, String)> = player_achievements::ftt_player_achievements
            .inner_join(achievements::ftt_achievements)
            .filter(player_achievements::user_id.eq_any(&user_ids))
            .order((player_achievements::user_id.asc(), player_achievements::unlocked_at.desc(), player_achievements::achievement_id.desc()))
            .select((player_achievements::user_id, achievements::emoji))
            .load::<(i32, String)>(conn)?;

        for (uid, emoji) in player_emojis {
            let list = emoji_map.entry(uid).or_default();
            if list.len() < 3 {
                list.push(emoji);
            }
        }
    }

    let entries = rows
        .into_iter()
        .enumerate()
        .map(|(idx, r)| {
            let latest_achievements = emoji_map.remove(&r.user_id).unwrap_or_default();
            LeaderboardEntry {
                rank: (idx + 1) as i32,
                user_id: r.user_id,
                user_name: r.user_name,
                wins: r.wins,
                losses: r.losses,
                draws: r.draws,
                win_loss_ratio: r.win_loss_ratio,
                latest_achievements,
            }
        })
        .collect();

    Ok(entries)
}

