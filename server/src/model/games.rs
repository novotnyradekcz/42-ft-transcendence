// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use crate::games::GameInfo;
use crate::model::database_initializer::{connection, DatabaseInitializer};
use diesel::prelude::*;

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

    // Check if Tic-Tac-Toe game already exists
    let existing_game_id = ftt_games
        .filter(name.eq("Tic-Tac-Toe"))
        .select(id)
        .first::<i32>(conn)
        .optional()?;

    if let Some(existing_id) = existing_game_id {
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

fn format_system_time(st: std::time::SystemTime) -> String {
    let dur = match st.duration_since(std::time::UNIX_EPOCH) {
        Ok(d) => d,
        Err(_) => return "N/A".to_string(),
    };
    let secs = dur.as_secs();
    let days = secs / 86400;
    let rem_secs = secs % 86400;
    let hours = rem_secs / 3600;
    let mins = (rem_secs % 3600) / 60;

    let z = days as i64 + 719468;
    let era = (if z >= 0 { z } else { z - 146096 }) / 146097;
    let doe = (z - era * 146097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };

    format!("{:04}-{:02}-{:02} {:02}:{:02}", y, m, d, hours, mins)
}

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
                played_at: format_system_time(r.played_at),
            }
        })
        .collect();

    Ok(result)
}

pub fn get_leaderboard_in_db(
    db: &mut DatabaseInitializer,
) -> Result<Vec<LeaderboardEntry>, diesel::result::Error> {
    use crate::schema::ftt_game_history::dsl as gh;
    use crate::schema::ftt_users::dsl as users;

    let conn = connection(db);
    let records = gh::ftt_game_history
        .select(DbGameHistoryRecord::as_select())
        .load::<DbGameHistoryRecord>(conn)?;

    let all_users = users::ftt_users
        .select((users::id, users::name))
        .load::<(i32, String)>(conn)?;

    let mut stats: std::collections::HashMap<i32, (i32, i32, i32)> = std::collections::HashMap::new();

    for (uid, _) in &all_users {
        stats.insert(*uid, (0, 0, 0));
    }

    for r in records {
        let p1 = r.player1_id;
        let p2 = r.player2_id;

        match r.winner_id {
            Some(w) => {
                if w == p1 {
                    stats.entry(p1).or_insert((0, 0, 0)).0 += 1;
                    stats.entry(p2).or_insert((0, 0, 0)).1 += 1;
                } else if w == p2 {
                    stats.entry(p2).or_insert((0, 0, 0)).0 += 1;
                    stats.entry(p1).or_insert((0, 0, 0)).1 += 1;
                }
            }
            None => {
                stats.entry(p1).or_insert((0, 0, 0)).2 += 1;
                stats.entry(p2).or_insert((0, 0, 0)).2 += 1;
            }
        }
    }

    let user_map: std::collections::HashMap<i32, String> = all_users.into_iter().collect();

    let mut entries: Vec<LeaderboardEntry> = stats
        .into_iter()
        .filter_map(|(uid, (wins, losses, draws))| {
            let total = wins + losses + draws;
            if total == 0 {
                return None;
            }
            let ratio = if losses == 0 {
                wins as f64
            } else {
                (wins as f64 / losses as f64 * 100.0).round() / 100.0
            };
            let uname = user_map.get(&uid).cloned().unwrap_or_else(|| format!("User #{}", uid));

            Some(LeaderboardEntry {
                rank: 0,
                user_id: uid,
                user_name: uname,
                wins,
                losses,
                draws,
                win_loss_ratio: ratio,
            })
        })
        .collect();

    entries.sort_by(|a, b| {
        b.win_loss_ratio
            .partial_cmp(&a.win_loss_ratio)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| b.wins.cmp(&a.wins))
    });

    entries.truncate(10);
    for (idx, entry) in entries.iter_mut().enumerate() {
        entry.rank = (idx + 1) as i32;
    }

    Ok(entries)
}

