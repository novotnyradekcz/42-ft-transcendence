// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct CreateUser {
    pub name: String,
    pub email: String,
    pub password: String,
}

#[derive(Serialize, Deserialize)]
pub struct LoginUser {
    pub name: String,
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
}

#[derive(Deserialize)]
pub struct CreateDiscussion {
    pub name: String,
    pub info: String,
    pub author: Option<i32>,
}

#[derive(Deserialize)]
pub struct CreatePost {
    pub author: Option<i32>,
    pub body: String,
}

#[derive(Deserialize)]
pub struct CreateMail {
    pub sender: Option<i32>,
    pub recipient: Option<i32>,
    pub to: Option<String>,
    pub title: String,
    pub body: String,
}

#[derive(Deserialize)]
pub struct MailQuery {
    #[serde(rename = "userId")]
    pub user_id: Option<i32>,
}

#[derive(Serialize)]
pub struct DiscussionPostInfo {
    pub id: i32,
    pub author: i32,
    pub name: String,
    pub perex: String,
    pub body: String,
    pub images: String,
}

#[derive(Serialize)]
pub struct DiscussionInfo {
    pub id: i32,
    #[serde(rename = "nPosts")]
    pub n_posts: i32,
    pub name: String,
    pub info: String,
    pub image: String,
    pub posts: Vec<DiscussionPostInfo>,
}

#[derive(Serialize)]
pub struct MailInfo {
    pub id: i32,
    pub sender: i32,
    pub recipient: i32,
    pub title: String,
    pub body: String,
    pub images: String,
}
