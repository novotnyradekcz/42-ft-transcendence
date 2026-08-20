// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use std::collections::HashMap;
use std::sync::Arc;
use actix_ws::{Session, Message};
use serde::{Serialize, Deserialize};
use actix_web::{get, web, Error, error::ErrorUnauthorized, HttpRequest, HttpResponse, rt::spawn};
use diesel::{Queryable, Selectable};
use crate::AppState;
use crate::websocket::{extract_auth_from_protocols, validate_credentials};
use crate::model::games::get_game_in_db;

#[derive(Serialize, Deserialize, Queryable, Selectable, Debug, Clone)]
#[diesel(table_name = crate::schema::ftt_games)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct GameInfo {
    pub id: i32,
    pub author: i32,
    pub name: String,
    pub body: String,
}

#[derive(Clone)]
pub struct Player {
    pub user_id: i32,
    pub name: String,
    pub session: Session,
    pub conn_id: u64,
}

#[allow(dead_code)]
#[derive(Clone)]
pub struct Room {
    pub id: String,
    pub game_id: i32,
    pub game_name: String,
    pub player1: Player,
    pub player2: Option<Player>,
    pub is_finished: bool,
}

pub struct Lobby {
    // Maps room_id -> Room
    pub rooms: HashMap<String, Room>,
    // Maps game_id -> waiting room_id
    pub waiting_rooms: HashMap<i32, String>,
}

impl Lobby {
    pub fn new() -> Self {
        Self {
            rooms: HashMap::new(),
            waiting_rooms: HashMap::new(),
        }
    }
}

#[derive(Deserialize)]
pub struct PlayQuery {
    #[serde(rename = "game_id")]
    pub game_id: i32,
    #[serde(rename = "user_id")]
    pub user_id: i32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CreateGame {
    pub name: String,
    pub body: String,
}

#[derive(Serialize)]
#[serde(tag = "type")]
pub enum WsServerMessage {
    #[serde(rename = "match_waiting")]
    MatchWaiting,
    #[serde(rename = "match_start")]
    MatchStart {
        player_index: i32,
        opponent_id: i32,
        opponent_name: String,
        game_name: String,
        script: String,
    },
    #[serde(rename = "game_action")]
    GameAction {
        data: String,
    },
    #[serde(rename = "achievement_unlocked")]
    AchievementUnlocked {
        achievements: Vec<crate::model::achievements::AchievementNotification>,
    },
    #[serde(rename = "opponent_disconnected")]
    OpponentDisconnected,
}

#[derive(Deserialize)]
#[serde(tag = "type")]
pub enum WsClientMessage {
    #[serde(rename = "game_action")]
    GameAction {
        data: String,
    },
}

static ROOM_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
static CONN_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

#[get("/ws")]
pub async fn play_game_ws(
    req: HttpRequest,
    stream: web::Payload,
    pool: web::Data<Arc<AppState>>,
    query: web::Query<PlayQuery>,
) -> Result<HttpResponse, Error> {
    let game_id = query.game_id;
    let user_id = query.user_id;
 
    // Extract auth from subprotocols (in Sec-WebSocket-Protocol)
    let (auth_creds, selected_protocol) = extract_auth_from_protocols(&req)
        .ok_or_else(|| ErrorUnauthorized("Missing authentication subprotocol"))?;
 
    // Validate credentials passed via the auth subprotocol (expects Basic Auth)
    let user = validate_credentials(&pool, user_id, &auth_creds)?;
    let user_name = user.name;

    // Upgrade the request to WebSocket
    let (response, session, mut msg_stream) = actix_ws::handle(&req, stream)?;
    let mut response = response;
    if let Ok(header_value) = actix_web::http::header::HeaderValue::from_str(&selected_protocol) {
        response.headers_mut().insert(
            actix_web::http::header::SEC_WEBSOCKET_PROTOCOL,
            header_value,
        );
    } else {
        return Err(actix_web::error::ErrorBadRequest("Invalid WebSocket subprotocol"));
    }

    // Clone session for connection management
    let mut session_clone = session.clone();
    let conn_id = CONN_COUNTER.fetch_add(1, std::sync::atomic::Ordering::SeqCst);

    // Lock lobby and matchmake
    let mut lobby_lock = pool.lobby.lock().unwrap();

    let mut start_match = None;
    let mut room_id = String::new();
    let mut player_index = 1;

    if let Some(waiting_id) = lobby_lock.waiting_rooms.get(&game_id).cloned() {
        // We found a waiting room!
        if let Some(room) = lobby_lock.rooms.get_mut(&waiting_id) {
            if room.player1.user_id == user_id {
                // Same user reconnecting to their own waiting room: replace player 1's session
                let old_session = room.player1.session.clone();
                room.player1 = Player {
                    user_id,
                    name: user_name.clone(),
                    session: session.clone(),
                    conn_id,
                };
                room_id = waiting_id.clone();
                player_index = 1;

                // Close the old session so its task loop exits
                actix_web::rt::spawn(async move {
                    let s = old_session;
                    let _ = s.close(None).await;
                });
            } else {
                // Different user joining as player 2
                let p2 = Player {
                    user_id,
                    name: user_name.clone(),
                    session: session.clone(),
                    conn_id,
                };
                room.player2 = Some(p2.clone());
                room_id = waiting_id.clone();
                player_index = 2;
                
                let p1 = room.player1.clone();
                start_match = Some((p1, p2));
            }
        }
    }

    if start_match.is_some() {
        lobby_lock.waiting_rooms.remove(&game_id);
    }

    if start_match.is_none() && room_id.is_empty() {
        // Create a new waiting room using atomic counter to generate room ID
        let num = ROOM_COUNTER.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        room_id = format!("room_{}", num);
        let p1 = Player {
            user_id,
            name: user_name,
            session: session.clone(),
            conn_id,
        };
        let new_room = Room {
            id: room_id.clone(),
            game_id,
            game_name: String::new(),
            player1: p1,
            player2: None,
            is_finished: false,
        };
        lobby_lock.rooms.insert(room_id.clone(), new_room);
        lobby_lock.waiting_rooms.insert(game_id, room_id.clone());
        player_index = 1;
    }

    drop(lobby_lock);

    // Spawn async task for websocket loop
    let pool_task = pool.clone();
    let room_id_task = room_id.clone();
    let conn_id_task = conn_id;

    spawn(async move {
        // If we are Player 1, tell the client we are waiting
        if player_index == 1 {
            let waiting_msg = serde_json::to_string(&WsServerMessage::MatchWaiting).unwrap();
            let _ = session_clone.text(waiting_msg).await;
        }

        // If we just joined as Player 2, trigger match start for both
        if let Some((p1, p2)) = start_match {
            // Load game script from DB
            let game = {
                let mut db_lock = pool_task.database.lock().unwrap();
                get_game_in_db(&mut db_lock, game_id).ok().flatten()
            };

            if let Some(g) = game {
                // Save game_name into the room
                {
                    let mut lobby_lock = pool_task.lobby.lock().unwrap();
                    if let Some(room) = lobby_lock.rooms.get_mut(&room_id_task) {
                        room.game_name = g.name.clone();
                    }
                }

                // Send match start to Player 1
                let start_p1 = serde_json::to_string(&WsServerMessage::MatchStart {
                    player_index: 1,
                    opponent_id: p2.user_id,
                    opponent_name: p2.name.clone(),
                    game_name: g.name.clone(),
                    script: g.body.clone(),
                }).unwrap();
                let mut p1_session = p1.session.clone();
                let _ = p1_session.text(start_p1).await;

                // Send match start to Player 2
                let start_p2 = serde_json::to_string(&WsServerMessage::MatchStart {
                    player_index: 2,
                    opponent_id: p1.user_id,
                    opponent_name: p1.name.clone(),
                    game_name: g.name.clone(),
                    script: g.body.clone(),
                }).unwrap();
                let mut p2_session = p2.session.clone();
                let _ = p2_session.text(start_p2).await;
            }
        }

        // Message receiver loop
        while let Some(Ok(msg)) = msg_stream.recv().await {
            match msg {
                Message::Ping(bytes) => {
                    if session_clone.pong(&bytes).await.is_err() {
                        break;
                    }
                }
                Message::Text(text) => {
                    // Parse text message
                    if let Ok(client_msg) = serde_json::from_str::<WsClientMessage>(&text) {
                        match client_msg {
                            WsClientMessage::GameAction { data } => {
                                // Relay to the other player & update state
                                let (opp_session, game_over_info) = {
                                    let mut lobby_lock = pool_task.lobby.lock().unwrap();
                                    if let Some(room) = lobby_lock.rooms.get_mut(&room_id_task) {
                                        let recipient_session = if player_index == 1 {
                                            room.player2.as_ref().map(|p| p.session.clone())
                                        } else {
                                            Some(room.player1.session.clone())
                                        };

                                        let game_over_info = if data.starts_with("game_over:") && !room.is_finished {
                                            room.is_finished = true;
                                            let val = &data["game_over:".len()..];
                                            let winner_id = match val {
                                                "1" => Some(room.player1.user_id),
                                                "2" => room.player2.as_ref().map(|p| p.user_id),
                                                _ => None,
                                            };
                                            let game_name = if room.game_name.is_empty() { "Game".to_string() } else { room.game_name.clone() };
                                            let p1_id = room.player1.user_id;
                                            let p2_id = room.player2.as_ref().map(|p| p.user_id);
                                            Some((p1_id, p2_id, winner_id, game_name))
                                        } else {
                                            None
                                        };

                                        (recipient_session, game_over_info)
                                    } else {
                                        (None, None)
                                    }
                                }; // lobby_lock is dropped here

                                if let Some(mut opp_session) = opp_session {
                                    let relay_msg = serde_json::to_string(&WsServerMessage::GameAction { data: data.clone() }).unwrap();
                                    let _ = opp_session.text(relay_msg).await;
                                }

                                if let Some((p1_id, Some(p2_id), winner_id, game_name)) = game_over_info {
                                    if let Ok(mut db) = pool_task.database.lock() {
                                        let _ = crate::model::games::save_game_history_in_db(
                                            &mut db,
                                            game_id,
                                            &game_name,
                                            p1_id,
                                            p2_id,
                                            winner_id,
                                        );

                                        let p1_ach = match crate::model::achievements::check_and_unlock_achievements_in_db(&mut db, p1_id) {
                                            Ok(v) => v,
                                            Err(e) => {
                                                eprintln!("[games] Failed to unlock achievements for p1 (user_id={}): {}", p1_id, e);
                                                Vec::new()
                                            }
                                        };
                                        let p2_ach = match crate::model::achievements::check_and_unlock_achievements_in_db(&mut db, p2_id) {
                                            Ok(v) => v,
                                            Err(e) => {
                                                eprintln!("[games] Failed to unlock achievements for p2 (user_id={}): {}", p2_id, e);
                                                Vec::new()
                                            }
                                        };
                                        let (p1_session, p2_session) = {
                                            let lobby_lock = pool_task.lobby.lock().unwrap();
                                            if let Some(room) = lobby_lock.rooms.get(&room_id_task) {
                                                (
                                                    Some(room.player1.session.clone()),
                                                    room.player2.as_ref().map(|p| p.session.clone()),
                                                )
                                            } else {
                                                (None, None)
                                            }
                                        };

                                        if !p1_ach.is_empty() {
                                            if let Some(mut s1) = p1_session {
                                                let msg = serde_json::to_string(&WsServerMessage::AchievementUnlocked {
                                                    achievements: p1_ach,
                                                }).unwrap();
                                                let _ = s1.text(msg).await;
                                            }
                                        }

                                        if !p2_ach.is_empty() {
                                            if let Some(mut s2) = p2_session {
                                                let msg = serde_json::to_string(&WsServerMessage::AchievementUnlocked {
                                                    achievements: p2_ach,
                                                }).unwrap();
                                                let _ = s2.text(msg).await;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                Message::Close(_) => {
                    break;
                }
                _ => {}
            }
        }

        // Clean up connection
        let cleanup_action = {
            let mut lobby_lock = pool_task.lobby.lock().unwrap();
            if let Some(room) = lobby_lock.rooms.get(&room_id_task) {
                let is_active_player = if player_index == 1 {
                    room.player1.conn_id == conn_id_task
                } else {
                    room.player2.as_ref().map(|p| p.conn_id) == Some(conn_id_task)
                };

                if is_active_player {
                    let room = lobby_lock.rooms.remove(&room_id_task).unwrap();

                    // Remove from waiting rooms if it was there
                    if let Some(waiting_id) = lobby_lock.waiting_rooms.get(&game_id) {
                        if waiting_id == &room_id_task {
                            lobby_lock.waiting_rooms.remove(&game_id);
                        }
                    }

                    // If game was active and not finished, remaining player wins by forfeit
                    let forfeit_info = if !room.is_finished && room.player2.is_some() {
                        let p1_id = room.player1.user_id;
                        let p2 = room.player2.as_ref().unwrap();
                        let p2_id = p2.user_id;
                        let winner_id = if player_index == 1 { Some(p2_id) } else { Some(p1_id) };
                        let game_name = if room.game_name.is_empty() { "Game".to_string() } else { room.game_name.clone() };
                        Some((p1_id, p2_id, winner_id, game_name))
                    } else {
                        None
                    };

                    // Notify the other player
                    let other_player = if player_index == 1 {
                        room.player2
                    } else {
                        Some(room.player1)
                    };

                    Some((forfeit_info, other_player))
                } else {
                    None
                }
            } else {
                None
            }
        }; // lobby_lock is dropped here

        if let Some((forfeit_info, other_player)) = cleanup_action {
            if let Some((p1_id, p2_id, winner_id, game_name)) = forfeit_info {
                if let Ok(mut db) = pool_task.database.lock() {
                    let _ = crate::model::games::save_game_history_in_db(
                        &mut db,
                        game_id,
                        &game_name,
                        p1_id,
                        p2_id,
                        winner_id,
                    );

                    let p1_ach = crate::model::achievements::check_and_unlock_achievements_in_db(&mut db, p1_id).unwrap_or_default();
                    let p2_ach = crate::model::achievements::check_and_unlock_achievements_in_db(&mut db, p2_id).unwrap_or_default();

                    let (p1_notify, p2_notify) = (p1_ach, p2_ach);

                    if player_index != 1 && !p1_notify.is_empty() {
                        let mut s1 = session_clone.clone();
                        let msg = serde_json::to_string(&WsServerMessage::AchievementUnlocked {
                            achievements: p1_notify.clone(),
                        }).unwrap();
                        let _ = s1.text(msg).await;
                    }

                    if let Some(ref opp) = other_player {
                        let opp_ach = if player_index == 1 { p2_notify } else { p1_notify };
                        if !opp_ach.is_empty() {
                            let mut opp_session = opp.session.clone();
                            let msg = serde_json::to_string(&WsServerMessage::AchievementUnlocked {
                                achievements: opp_ach,
                            }).unwrap();
                            let _ = opp_session.text(msg).await;
                        }
                    }
                }
            }

            if let Some(opp) = other_player {
                let disconnect_msg = serde_json::to_string(&WsServerMessage::OpponentDisconnected).unwrap();
                let mut opp_session = opp.session;
                let _ = opp_session.text(disconnect_msg).await;
                let _ = opp_session.close(None).await;
            }
        }
    });

    Ok(response)
}