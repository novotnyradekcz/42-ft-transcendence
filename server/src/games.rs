// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use std::collections::HashMap;
use std::sync::Mutex;
use actix_ws::{Session, Message};
use serde::{Serialize, Deserialize};
use actix_web::{get, web, Error, HttpRequest, HttpResponse};
use crate::model::DatabaseInitializer;
use crate::router::get_game_in_db;

#[derive(Clone)]
pub struct Player {
    pub user_id: i32,
    pub name: String,
    pub session: Session,
}

#[derive(Clone)]
pub struct Room {
    pub id: String,
    pub game_id: i32,
    pub player1: Player,
    pub player2: Option<Player>,
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

#[get("/play/ws")]
pub async fn play_game_ws(
    req: HttpRequest,
    stream: web::Payload,
    lobby: web::Data<Mutex<Lobby>>,
    db: web::Data<Mutex<DatabaseInitializer>>,
    query: web::Query<PlayQuery>,
) -> Result<HttpResponse, Error> {
    let game_id = query.game_id;
    let user_id = query.user_id;

    // Get user name from DB
    let user_name = {
        let mut db_lock = db.lock().unwrap();
        match crate::model::user_handler::get_user_in_db(&mut db_lock, user_id) {
            Ok(Some(u)) => u.name,
            _ => format!("User#{}", user_id),
        }
    };

    // Upgrade the request to WebSocket
    let (response, session, mut msg_stream) = actix_ws::handle(&req, stream)?;

    // Clone session for connection management
    let mut session_clone = session.clone();

    // Lock lobby and matchmake
    let mut lobby_lock = lobby.lock().unwrap();

    let mut start_match = None;
    let mut room_id = String::new();
    let mut player_index = 1;

    if let Some(waiting_id) = lobby_lock.waiting_rooms.get(&game_id).cloned() {
        // We found a waiting room!
        if let Some(room) = lobby_lock.rooms.get_mut(&waiting_id) {
            // Join as player 2
            let p2 = Player {
                user_id,
                name: user_name.clone(),
                session: session.clone(),
            };
            room.player2 = Some(p2.clone());
            room_id = waiting_id.clone();
            player_index = 2;
            
            let p1 = room.player1.clone();
            start_match = Some((p1, p2));
        }
    }

    if start_match.is_some() {
        lobby_lock.waiting_rooms.remove(&game_id);
    }

    if start_match.is_none() {
        // Create a new waiting room using atomic counter to generate room ID
        let num = ROOM_COUNTER.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        room_id = format!("room_{}", num);
        let p1 = Player {
            user_id,
            name: user_name,
            session: session.clone(),
        };
        let new_room = Room {
            id: room_id.clone(),
            game_id,
            player1: p1,
            player2: None,
        };
        lobby_lock.rooms.insert(room_id.clone(), new_room);
        lobby_lock.waiting_rooms.insert(game_id, room_id.clone());
        player_index = 1;
    }

    drop(lobby_lock);

    // Spawn async task for websocket loop
    let lobby_task = lobby.clone();
    let db_task = db.clone();
    let room_id_task = room_id.clone();

    actix_web::rt::spawn(async move {
        // If we are Player 1, tell the client we are waiting
        if player_index == 1 {
            let waiting_msg = serde_json::to_string(&WsServerMessage::MatchWaiting).unwrap();
            let _ = session_clone.text(waiting_msg).await;
        }

        // If we just joined as Player 2, trigger match start for both
        if let Some((p1, p2)) = start_match {
            // Load game script from DB
            let game = {
                let mut db_lock = db_task.lock().unwrap();
                get_game_in_db(&mut db_lock, game_id).ok().flatten()
            };

            if let Some(g) = game {
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
                                // Relay to the other player
                                let lobby_lock = lobby_task.lock().unwrap();
                                if let Some(room) = lobby_lock.rooms.get(&room_id_task) {
                                    let recipient = if player_index == 1 {
                                        room.player2.as_ref()
                                    } else {
                                        Some(&room.player1)
                                    };

                                    if let Some(opp) = recipient {
                                        let relay_msg = serde_json::to_string(&WsServerMessage::GameAction { data }).unwrap();
                                        let mut opp_session = opp.session.clone();
                                        let _ = opp_session.text(relay_msg).await;
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
        let mut lobby_lock = lobby_task.lock().unwrap();
        // Remove room from lobby
        if let Some(room) = lobby_lock.rooms.remove(&room_id_task) {
            // Remove from waiting rooms if it was there
            if let Some(waiting_id) = lobby_lock.waiting_rooms.get(&game_id) {
                if waiting_id == &room_id_task {
                    lobby_lock.waiting_rooms.remove(&game_id);
                }
            }

            // Notify the other player
            let other_player = if player_index == 1 {
                room.player2
            } else {
                Some(room.player1)
            };

            if let Some(opp) = other_player {
                let disconnect_msg = serde_json::to_string(&WsServerMessage::OpponentDisconnected).unwrap();
                let mut opp_session = opp.session.clone();
                let _ = opp_session.text(disconnect_msg).await;
                let _ = opp_session.close(None).await;
            }
        }
    });

    Ok(response)
}
