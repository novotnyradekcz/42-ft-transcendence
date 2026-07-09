// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct CreateUser {
    pub name: String,
    pub email: String,
    pub password: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UserInfo {
    pub id: i32,
    pub name: String,
    pub email: String,
    pub bio: String,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: String,
    pub status: String,
    pub friends: Vec<i32>,
}
