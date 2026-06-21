use serde::{Deserialize, Serialize};

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
pub struct MailInfo {
    pub id: i32,
    pub sender: i32,
    pub recipient: i32,
    pub title: String,
    pub body: String,
    pub images: String,
}