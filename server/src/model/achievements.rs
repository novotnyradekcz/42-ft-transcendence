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

    // Fetch user stats from ftt_game_history
    let user_history = gh::ftt_game_history
        .filter(gh::player1_id.eq(target_user_id).or(gh::player2_id.eq(target_user_id)))
        .select((gh::player1_id, gh::player2_id, gh::winner_id))
        .load::<(i32, i32, Option<i32>)>(conn)?;

    let played_count = user_history.len() as i32;
    let wins_count = user_history
        .iter()
        .filter(|(_, _, w)| *w == Some(target_user_id))
        .count() as i32;
    let losses_count = user_history
        .iter()
        .filter(|(_, _, w)| w.is_some() && *w != Some(target_user_id))
        .count() as i32;

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
