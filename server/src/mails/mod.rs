use crate::model::mails::Mail;
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

impl From<Mail> for MailInfo {
    fn from(mail: Mail) -> Self {
        Self {
            id: mail.get_id(),
            sender: mail.get_sender(),
            recipient: mail.get_recipient(),
            title: mail.get_title().to_owned(),
            body: mail.get_body().to_owned(),
            images: mail.get_images().to_owned(),
        }
    }
}

// TryFrom<Mail> for MailInfo is provided automatically by the standard library
// blanket impl `impl<T, U: From<T>> TryFrom<T> for U`, with Error = Infallible.

#[cfg(test)]
mod tests {
    use super::*;
    use std::convert::TryFrom;

    #[test]
    fn test_mail_info_from_mail() {
        let mail = Mail::new(1, 2, 3, "Hello", "World", "");
        let info = MailInfo::from(mail);

        assert_eq!(info.id, 1);
        assert_eq!(info.sender, 2);
        assert_eq!(info.recipient, 3);
        assert_eq!(info.title, "Hello");
        assert_eq!(info.body, "World");
        assert_eq!(info.images, "");
    }

    #[test]
    fn test_mail_info_from_mail_with_images() {
        let mail = Mail::new(10, 20, 30, "Subject", "Content", "img.png");
        let info = MailInfo::from(mail);

        assert_eq!(info.id, 10);
        assert_eq!(info.sender, 20);
        assert_eq!(info.recipient, 30);
        assert_eq!(info.title, "Subject");
        assert_eq!(info.body, "Content");
        assert_eq!(info.images, "img.png");
    }

    #[test]
    fn test_mail_info_try_from_mail() {
        let mail = Mail::new(5, 6, 7, "TryFrom title", "TryFrom body", "");
        let info = MailInfo::try_from(mail).expect("conversion is infallible");

        assert_eq!(info.id, 5);
        assert_eq!(info.sender, 6);
        assert_eq!(info.recipient, 7);
        assert_eq!(info.title, "TryFrom title");
        assert_eq!(info.body, "TryFrom body");
        assert_eq!(info.images, "");
    }
}
