// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

pub(crate) mod discussion_response_factory;

use serde::{Deserialize, Serialize};
use crate::model::discussions::Post;

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

pub fn discussion_marker(discussion_id: i32) -> String {
    format!("discussion:{}", discussion_id)
}

pub fn public_post(post: Post) -> DiscussionPostInfo {
    let images = if post.get_images().starts_with("discussion:") {
        String::new()
    } else {
        post.get_images()
    };

    DiscussionPostInfo {
        id: post.get_id(),
        author: post.get_author(),
        name: post.get_name(),
        perex: post.get_perex(),
        body: post.get_body(),
        images,
    }
}