pub(crate) mod database_initializer;
mod database_migrations;
pub mod games;

pub(crate) mod users;
pub(crate) mod discussions;
pub(crate) mod mails;
pub(crate) mod session;
pub(crate) mod achievements;

pub(crate) use database_initializer::DatabaseInitializer;

pub(crate) fn format_system_time(st: std::time::SystemTime) -> String {
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

