// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

//! The user shapes that cross the HTTP boundary: what registration accepts, and
//! what the API gives back. The database side is `model::users`.

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use serde::{Deserialize, Serialize};

// ----------------Consts----------------

/// Max length of the incoming URL in bytes
///
/// It's checked against the string before any decoding
/// Base roughly increases size by 4/3, so this is roughly 525 KB
/// of the actual image
/// Actix caps the whole request payload at 2MB (`DEFAULT_LIMIT`)
/// That is outerbound, this is the inner one.
const MAX_AVATAR_URL_SIZE: usize = 700 * 1024;

/// Max length of the bio
///
/// Counted in chars rather than bytes, so language of choice does not matter.
/// There is no precise database limit. I chose arbitrary length so it just
/// fits the prettiest of poems
const MAX_BIO_LEN: usize = 1726;

/// Whitelist of allowed file types paired with respective magic bytes
///
/// The payload must begin with either of the magic byte sequence.
/// Magic bytes help recognize the payload type irrespective of the
/// overt extension at the end of the file.
/// No SVG also because it has `<script>` option that can turn malicious
const ALLOWED_AVATAR_TYPES: [(&str, &[u8]); 2] = [
    (
        "data:image/png;base64,",
        &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
    ),
    ("data:image/jpeg;base64,", &[0xFF, 0xD8, 0xFF]),
];

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

// what every user-facing route returns. no password field, so a hash cannot be
// serialised into a response by accident
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

#[derive(Deserialize)]
pub struct UpdateProfile {
    pub bio: Option<String>,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
}

impl UpdateProfile {
    pub fn validate(&self) -> Result<(), &'static str> {
        if let Some(bio) = &self.bio {
            if bio.chars().count() > MAX_BIO_LEN {
                return Err("The length of your bio is bigger than the set limit.");
            }

            // Postgres does not support null char
            if bio.contains('\0') {
                return Err("Bio contains the unsupported NULL char.");
            }
        }
        if let Some(avatar_url) = &self.avatar_url {
            validate_avatar_url(avatar_url)?;
        }

        Ok(())
    }
}

fn validate_avatar_url(payload: &str) -> Result<(), &'static str> {
    if payload.is_empty() {
        return Ok(());
    }

    if payload.len() > MAX_AVATAR_URL_SIZE {
        return Err("Avatar image is too large.");
    }

    let (encoded, magic) = ALLOWED_AVATAR_TYPES
        .iter()
        .find_map(|(prefix, magic)| payload.strip_prefix(prefix).map(|rest| (rest, *magic)))
        .ok_or("Avatar must be a PNG or JPEG")?;

    let decoded = STANDARD
        .decode(encoded)
        .map_err(|_| "Avatar is ill-encoded, not valid base64.")?;

    if !decoded.starts_with(magic) {
        return Err("Avatar data do not match the declared type.");
    }

    Ok(())
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

    // -------UpdateProfile------------

    /// 1×1 PNG, 70 bytes decoded.
    const PNG_DATA_URL: &str = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

    /// A real 1×1 JPEG, 120 bytes decoded.
    const JPEG_DATA_URL: &str = "data:image/jpeg;base64,/9j/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wgALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//aAAgBAQAAPwBU3//Z";

    fn update(bio: Option<&str>, avatar_url: Option<&str>) -> UpdateProfile {
        UpdateProfile {
            bio: bio.map(str::to_string),
            avatar_url: avatar_url.map(str::to_string),
        }
    }

    #[test]
    fn empty_update_passes_validation() {
        assert!(update(None, None).validate().is_ok());
    }

    #[test]
    fn png_data_url_passes_validation() {
        assert!(update(None, Some(PNG_DATA_URL)).validate().is_ok());
    }

    #[test]
    fn jpeg_data_url_passes_validation() {
        assert!(update(None, Some(JPEG_DATA_URL)).validate().is_ok());
    }

    /// Empty is how the client asks for the avatar to be removed.
    #[test]
    fn empty_avatar_url_passes_validation() {
        assert!(update(None, Some("")).validate().is_ok());
    }

    #[test]
    fn remote_avatar_url_fails_validation() {
        assert_eq!(
            update(None, Some("https://tracker.example/pixel.png")).validate(),
            Err("Avatar must be a PNG or JPEG")
        );
    }

    /// The point of the magic-byte check: the prefix is a claim, not evidence.
    #[test]
    fn html_disguised_as_png_fails_validation() {
        let disguised =
            "data:image/png;base64,PGh0bWw+PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0PjwvaHRtbD4=";
        assert_eq!(
            update(None, Some(disguised)).validate(),
            Err("Avatar data do not match the declared type.")
        );
    }

    #[test]
    fn malformed_base64_fails_validation() {
        assert_eq!(
            update(None, Some("data:image/png;base64,not valid !!")).validate(),
            Err("Avatar is ill-encoded, not valid base64.")
        );
    }

    #[test]
    fn oversized_avatar_fails_validation() {
        let huge = format!("data:image/png;base64,{}", "A".repeat(MAX_AVATAR_URL_SIZE));
        assert_eq!(
            update(None, Some(&huge)).validate(),
            Err("Avatar image is too large.")
        );
    }

    #[test]
    fn overlong_bio_fails_validation() {
        let long = "a".repeat(MAX_BIO_LEN + 1);
        assert_eq!(
            update(Some(&long), None).validate(),
            Err("The length of your bio is bigger than the set limit.")
        );
    }

    /// Postgres `TEXT` cannot store NUL, so this must be a 400 and not a 500.
    #[test]
    fn bio_with_nul_byte_fails_validation() {
        assert_eq!(
            update(Some("hello\0world"), None).validate(),
            Err("Bio contains the unsupported NULL char.")
        );
    }

    /// An omitted field must deserialize to `None`, not to an empty string.
    #[test]
    fn update_profile_deserializes_partial_body() {
        let json = r#"{"bio":"new bio"}"#;
        let update: UpdateProfile = serde_json::from_str(json).expect("must deserialize");
        assert_eq!(update.bio.as_deref(), Some("new bio"));
        assert!(update.avatar_url.is_none());
    }

    #[test]
    fn update_profile_honours_camel_case_avatar_url() {
        let json = r#"{"avatarUrl":"data:image/png;base64,AAAA"}"#;
        let update: UpdateProfile = serde_json::from_str(json).expect("must deserialize");
        assert_eq!(
            update.avatar_url.as_deref(),
            Some("data:image/png;base64,AAAA")
        );
        assert!(update.bio.is_none());
    }
}
