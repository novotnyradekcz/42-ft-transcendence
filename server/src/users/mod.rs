// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct CreateUser {
    pub name: String,
    pub email: String,
    pub password: String,
}

impl CreateUser {
    /// Returns `Err` with a message if any required field is blank.
    pub fn validate(&self) -> Result<(), &'static str> {
        if self.name.trim().is_empty() {
            return Err("Name is required.");
        }
        if self.email.trim().is_empty() {
            return Err("Email is required.");
        }
        if self.password.trim().is_empty() {
            return Err("Password is required.");
        }
        Ok(())
    }
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


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_create_user_passes_validation() {
        let user = CreateUser {
            name: "alice".to_string(),
            email: "alice@example.com".to_string(),
            password: "secret123".to_string(),
        };
        assert!(user.validate().is_ok());
    }

    #[test]
    fn empty_name_fails_validation() {
        let user = CreateUser {
            name: "".to_string(),
            email: "alice@example.com".to_string(),
            password: "secret123".to_string(),
        };
        assert_eq!(user.validate(), Err("Name is required."));
    }

    #[test]
    fn whitespace_only_name_fails_validation() {
        let user = CreateUser {
            name: "   ".to_string(),
            email: "alice@example.com".to_string(),
            password: "secret123".to_string(),
        };
        assert_eq!(user.validate(), Err("Name is required."));
    }

    #[test]
    fn empty_email_fails_validation() {
        let user = CreateUser {
            name: "alice".to_string(),
            email: "".to_string(),
            password: "secret123".to_string(),
        };
        assert_eq!(user.validate(), Err("Email is required."));
    }

    #[test]
    fn empty_password_fails_validation() {
        let user = CreateUser {
            name: "alice".to_string(),
            email: "alice@example.com".to_string(),
            password: "".to_string(),
        };
        assert_eq!(user.validate(), Err("Password is required."));
    }

    #[test]
    fn whitespace_only_password_fails_validation() {
        let user = CreateUser {
            name: "alice".to_string(),
            email: "alice@example.com".to_string(),
            password: "  ".to_string(),
        };
        assert_eq!(user.validate(), Err("Password is required."));
    }

    #[test]
    fn create_user_deserializes_from_json() {
        let json = r#"{"name":"bob","email":"bob@example.com","password":"pw"}"#;
        let user: CreateUser = serde_json::from_str(json).expect("must deserialize");
        assert_eq!(user.name, "bob");
        assert_eq!(user.email, "bob@example.com");
        assert_eq!(user.password, "pw");
    }
}
