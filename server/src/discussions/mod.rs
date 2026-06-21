use serde::{Deserialize, Serialize};

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
