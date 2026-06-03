// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct CreateUser {
    pub name: String,
    pub email: String,
    pub password: String
}

#[derive(Serialize, Deserialize)]
pub struct LoginUser {
    pub name: String,
    pub password: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UserInfo {
    pub user_id: u32,
    pub user_name: String,
    pub user_email: String,
    pub friends: Vec<UserInfo>,
}
