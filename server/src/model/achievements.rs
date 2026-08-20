// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use crate::model::database_initializer::{connection, DatabaseInitializer};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Queryable, Selectable, Debug, Clone)]
#[diesel(table_name = crate::schema::ftt_achievements)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct DbAchievement {
    pub id: i32,
    pub name: String,
    pub description: String,
    pub emoji: String,
}

#[derive(Serialize, Deserialize, Queryable, Selectable, Debug, Clone)]
#[diesel(table_name = crate::schema::ftt_player_achievements)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct DbPlayerAchievement {
    pub user_id: i32,
    pub achievement_id: i32,
    pub unlocked_at: std::time::SystemTime,
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::ftt_player_achievements)]
pub struct NewPlayerAchievement {
    pub user_id: i32,
    pub achievement_id: i32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UserAchievementResponse {
    pub id: i32,
    pub name: String,
    pub description: String,
    pub emoji: String,
    pub unlocked: bool,
    pub unlocked_at: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AchievementNotification {
    pub id: i32,
    pub name: String,
    pub description: String,
    pub emoji: String,
}

use super::format_system_time;

pub fn get_user_achievements_in_db(
    db: &mut DatabaseInitializer,
    target_user_id: i32,
) -> Result<Vec<UserAchievementResponse>, diesel::result::Error> {
    use crate::schema::ftt_achievements::dsl as ach;
    use crate::schema::ftt_player_achievements::dsl as pa;

    let conn = connection(db);

    let all_achievements = ach::ftt_achievements
        .order(ach::id.asc())
        .select(DbAchievement::as_select())
        .load::<DbAchievement>(conn)?;

    let unlocked_records = pa::ftt_player_achievements
        .filter(pa::user_id.eq(target_user_id))
        .select(DbPlayerAchievement::as_select())
        .load::<DbPlayerAchievement>(conn)?;

    let unlocked_map: std::collections::HashMap<i32, std::time::SystemTime> = unlocked_records
        .into_iter()
        .map(|r| (r.achievement_id, r.unlocked_at))
        .collect();

    let response = all_achievements
        .into_iter()
        .map(|a| {
            let unlocked_at = unlocked_map.get(&a.id).cloned().map(format_system_time);
            let unlocked = unlocked_at.is_some();
            UserAchievementResponse {
                id: a.id,
                name: a.name,
                description: a.description,
                emoji: a.emoji,
                unlocked,
                unlocked_at,
            }
        })
        .collect();

    Ok(response)
}

pub fn check_and_unlock_achievements_in_db(
    db: &mut DatabaseInitializer,
    target_user_id: i32,
) -> Result<Vec<AchievementNotification>, diesel::result::Error> {
    use crate::schema::ftt_achievements::dsl as ach;
    use crate::schema::ftt_game_history::dsl as gh;
    use crate::schema::ftt_player_achievements::dsl as pa;

    let conn = connection(db);

    // Fetch user stats from ftt_game_history (avoid loading full history into memory)
    let played_count = gh::ftt_game_history
        .filter(gh::player1_id.eq(target_user_id).or(gh::player2_id.eq(target_user_id)))
        .count()
        .get_result::<i64>(conn)? as i32;

    let wins_count = gh::ftt_game_history
        .filter(gh::player1_id.eq(target_user_id).or(gh::player2_id.eq(target_user_id)))
        .filter(gh::winner_id.eq(Some(target_user_id)))
        .count()
        .get_result::<i64>(conn)? as i32;

    let losses_count = gh::ftt_game_history
        .filter(gh::player1_id.eq(target_user_id).or(gh::player2_id.eq(target_user_id)))
        .filter(gh::winner_id.is_not_null().and(gh::winner_id.ne(Some(target_user_id))))
        .count()
        .get_result::<i64>(conn)? as i32;

    // Fetch currently unlocked achievement IDs
    let already_unlocked: std::collections::HashSet<i32> = pa::ftt_player_achievements
        .filter(pa::user_id.eq(target_user_id))
        .select(pa::achievement_id)
        .load::<i32>(conn)?
        .into_iter()
        .collect();

    let all_achievements = ach::ftt_achievements
        .order(ach::id.asc())
        .select(DbAchievement::as_select())
        .load::<DbAchievement>(conn)?;

    let mut newly_unlocked = Vec::new();

    for a in all_achievements {
        if already_unlocked.contains(&a.id) {
            continue;
        }

        let should_unlock = match a.id {
            1 => played_count >= 1,  // Playa
            2 => wins_count >= 1,    // Winner
            3 => losses_count >= 1,  // No shame in losing
            4 => played_count >= 3,  // Serial playa
            5 => wins_count >= 3,    // Serial winner
            6 => losses_count >= 3,  // It builds character
            7 => played_count >= 10, // Big Playa
            8 => wins_count >= 10, // Big Winner
            9 => losses_count >= 10, // They must be cheating
            _ => false,
        };

        if should_unlock {
            diesel::insert_into(pa::ftt_player_achievements)
                .values(&NewPlayerAchievement {
                    user_id: target_user_id,
                    achievement_id: a.id,
                })
                .on_conflict_do_nothing()
                .execute(conn)?;

            newly_unlocked.push(AchievementNotification {
                id: a.id,
                name: a.name,
                description: a.description,
                emoji: a.emoji,
            });
        }
    }

    Ok(newly_unlocked)
}

pub fn check_game_achievements_for_players(
    db: &mut DatabaseInitializer,
    p1_id: i32,
    p2_id: i32,
) -> (Vec<AchievementNotification>, Vec<AchievementNotification>) {
    let p1_ach = check_and_unlock_achievements_in_db(db, p1_id).unwrap_or_else(|e| {
        eprintln!("[achievements] Failed to unlock achievements for player {p1_id}: {e}");
        Vec::new()
    });

    let p2_ach = check_and_unlock_achievements_in_db(db, p2_id).unwrap_or_else(|e| {
        eprintln!("[achievements] Failed to unlock achievements for player {p2_id}: {e}");
        Vec::new()
    });

    (p1_ach, p2_ach)
}

