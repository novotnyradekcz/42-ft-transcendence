// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

// use actix_security::http::security::SessionUser;
// use actix_security::http::security::session::SessionConfig;
//
// pub(crate) async fn user_from_session(session: &actix_session::Session) -> Result<SessionUser, String> {
//     match session.get("id") {
//         Ok(user_id) => match user_id {
//             Some(id) => Ok(id),
//             None => Err("You are not authenticated".to_string())
//         },
//         Err(e) => {Err(format!("{e}"))}
//     }
// }