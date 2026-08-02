// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

//! Online-status with WebSockets
//! Each loggedin tab opens one connection to `/status/ws`; a user counts as online
//! while any tab is connected. The socket itself is the presence signal. Clients
//! learn who's online from the connect snapshot and each keepalive ping, so the
//! server never pushes updates or holds onto other users' sessions.
//! Status is runtime-only and never written to `ftt_users`, since a status column
//! would go stale the moment the process died.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use actix_web::{
    Error, HttpRequest, HttpResponse, error::ErrorInternalServerError,
    error::ErrorUnauthorized, get, http::header, rt::spawn, web,
};
use actix_ws::Message;
use serde::{Deserialize, Serialize};

use crate::AppState;
use crate::websocket::{extract_auth_from_protocols, validate_credentials};

/// Unique per connection, so closing one tab doesn't deregister the others.
/// Relaxed is enough — `fetch_add` guarantees uniqueness on its own, and the id is
/// only ever read after the registry's mutex has been taken, which orders it for us.
static CONNECTION_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Tracks which users currently have at least one open connection.
pub struct StatusRegistry {
    connections: HashMap<i32, HashSet<u64>>,
}

impl StatusRegistry {
    pub fn new() -> Self {
        Self {
            connections: HashMap::new(),
        }
    }

    /// Registers a connection for this user.
    fn add(&mut self, user_id: i32, conn_id: u64) {
        self.connections.entry(user_id).or_default().insert(conn_id);
    }

    /// Removes a connection; drops the user once their last tab closes.
    fn remove(&mut self, user_id: i32, conn_id: u64) {
        let Some(tabs) = self.connections.get_mut(&user_id) else {
            return;
        };
        tabs.remove(&conn_id);
        if tabs.is_empty() {
            self.connections.remove(&user_id);
        }
    }

    /// Ids of every online user. Sorted only for reproducible output — the client
    /// builds a Set from this, so the order itself carries no meaning.
    fn online_ids(&self) -> Vec<i32> {
        let mut ids: Vec<i32> = self.connections.keys().copied().collect();
        ids.sort_unstable();
        ids
    }
}

impl Default for StatusRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Serialize)]
#[serde(tag = "type")]
pub enum StatusServerMessage {
    /// Full snapshot, sent on connect and in reply to a client ping.
    #[serde(rename = "status_init")]
    StatusInit { online: Vec<i32> },
}

#[derive(Deserialize)]
#[serde(tag = "type")]
pub enum StatusClientMessage {
    /// Keepalive. Answered with a fresh `status_init`, which is also how a client
    /// picks up anyone who connected or left since it last asked.
    #[serde(rename = "ping")]
    Ping,
}

#[derive(Deserialize)]
pub struct StatusQuery {
    pub user_id: i32,
}

#[get("/ws")]
pub async fn status_ws(
    req: HttpRequest,
    stream: web::Payload,
    pool: web::Data<Arc<AppState>>,
    query: web::Query<StatusQuery>,
) -> Result<HttpResponse, Error> {
    let user_id = query.user_id;

    // Credentials ride in the subprotocol — browsers can't set an Authorization
    // header on a WebSocket handshake — so auth happens before the upgrade.
    let (auth_creds, selected_protocol) = extract_auth_from_protocols(&req)
        .ok_or_else(|| ErrorUnauthorized("Missing authentication subprotocol"))?;
    validate_credentials(&pool, user_id, &auth_creds)?;

    let (response, session, mut msg_stream) = actix_ws::handle(&req, stream)?;
    let mut response = response;
    response.headers_mut().insert(
        header::SEC_WEBSOCKET_PROTOCOL,
        header::HeaderValue::from_str(&selected_protocol).map_err(ErrorInternalServerError)?,
    );

    let conn_id = CONNECTION_COUNTER.fetch_add(1, Ordering::Relaxed);
    let mut own_session = session;

    // Snapshot inside the lock, then release it before awaiting — holding a
    // MutexGuard across `.await` would stall the worker thread.
    let online_now = {
        let mut registry = pool
            .status
            .lock()
            .map_err(|_| ErrorInternalServerError("Status registry lock poisoned"))?;
        registry.add(user_id, conn_id);
        registry.online_ids()
    };

    let pool_task = pool.clone();

    spawn(async move {
        // Tell the newcomer who is already here.
        if let Ok(snapshot) =
            serde_json::to_string(&StatusServerMessage::StatusInit { online: online_now })
        {
            let _ = own_session.text(snapshot).await;
        }

        while let Some(Ok(msg)) = msg_stream.recv().await {
            match msg {
                Message::Ping(bytes) => {
                    if own_session.pong(&bytes).await.is_err() {
                        break;
                    }
                }
                Message::Text(text) => {
                    if let Ok(StatusClientMessage::Ping) =
                        serde_json::from_str::<StatusClientMessage>(&text)
                    {
                        let online_now = {
                            match pool_task.status.lock() {
                                Ok(registry) => registry.online_ids(),
                                Err(_) => break,
                            }
                        };
                        if let Ok(snapshot) =
                            serde_json::to_string(&StatusServerMessage::StatusInit {
                                online: online_now,
                            })
                        {
                            if own_session.text(snapshot).await.is_err() {
                                break;
                            }
                        }
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }

        if let Ok(mut registry) = pool_task.status.lock() {
            registry.remove(user_id, conn_id);
        }
    });

    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Closing one of two tabs must not take the user offline.
    #[test]
    fn user_goes_offline_only_when_the_last_tab_closes() {
        let mut reg = StatusRegistry::new();
        reg.add(1, 100);
        reg.add(1, 101);

        reg.remove(1, 100);
        assert_eq!(reg.online_ids(), vec![1]);

        reg.remove(1, 101);
        assert!(reg.online_ids().is_empty());
    }

    #[test]
    fn removing_an_unknown_connection_is_a_noop() {
        let mut reg = StatusRegistry::new();
        reg.add(1, 100);

        reg.remove(1, 999); // right user, wrong connection
        reg.remove(2, 100); // wrong user
        assert_eq!(reg.online_ids(), vec![1]);
    }

    // A retried registration shouldn't leave a phantom tab that never closes.
    #[test]
    fn adding_the_same_connection_twice_counts_once() {
        let mut reg = StatusRegistry::new();
        reg.add(1, 100);
        reg.add(1, 100);

        reg.remove(1, 100);
        assert!(reg.online_ids().is_empty());
    }

    // Inserted out of order to exercise the sort too.
    #[test]
    fn online_ids_lists_every_connected_user_in_order() {
        let mut reg = StatusRegistry::new();
        reg.add(9, 1);
        reg.add(2, 2);
        reg.add(7, 3);

        assert_eq!(reg.online_ids(), vec![2, 7, 9]);
    }

    #[test]
    fn a_fresh_registry_has_nobody_online() {
        assert!(StatusRegistry::new().online_ids().is_empty());
    }
}
