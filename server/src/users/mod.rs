// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct CreateUser {
    pub name: String,
    pub email: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct UserInfo {
    user_id: u32,
    friends: Vec<UserInfo>,
}