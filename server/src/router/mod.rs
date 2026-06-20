// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use std::sync::{Arc, Mutex};
//use actix_security::prelude::AuthenticatedUser;
//use actix_security::{pre_authorize, secured};
use actix_security::http::security::{AuthenticatedUser, AuthenticationManager, AuthorizationManager, Argon2PasswordEncoder, PasswordEncoder, User, MemoryAuthenticator, RequestMatcherAuthorizer, Access};
use serde::{Serialize, Deserialize};
use serde_json;
use downcast_rs::Downcast;
use actix_web::{App, HttpServer, HttpResponse, Responder, web, get, post};
use diesel::{Insertable, Queryable, Selectable};
use crate::authenticator::register_user;
use crate::users::{CreateUser, LoginUser};
use crate::model::user_handler::{create_user_in_db};
use crate::model::database_initializer::{DatabaseInitializer};
use crate::model::user_handler::CreateUserError;
use crate::model::user_handler::{
    create_user_in_db, get_user_in_db, list_users_in_db, login_user_in_db,
};
use crate::users::{CreateDiscussion, CreateMail, CreatePost, CreateUser, LoginUser, MailQuery};


pub async fn index() -> HttpResponse {
    HttpResponse::Ok().body("Welcome")
}

#[derive(Queryable, Selectable)]
#[diesel(table_name = crate::schema::ftt_discussions)]
#[diesel(check_for_backend(diesel::pg::Pg))]
struct Discussion {
    id: i32,
    n_posts: i32,
    name: String,
    info: String,
    image: String,
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::ftt_discussions)]
struct NewDiscussion<'a> {
    name: &'a str,
    info: &'a str,
    image: &'a str,
}

#[derive(Queryable, Selectable)]
#[diesel(table_name = crate::schema::ftt_posts)]
#[diesel(check_for_backend(diesel::pg::Pg))]
struct Post {
    id: i32,
    author: i32,
    name: String,
    perex: String,
    body: String,
    images: String,
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::ftt_posts)]
struct NewPost<'a> {
    author: i32,
    name: &'a str,
    perex: &'a str,
    body: &'a str,
    images: &'a str,
}

#[derive(Queryable, Selectable)]
#[diesel(table_name = crate::schema::ftt_mail)]
#[diesel(check_for_backend(diesel::pg::Pg))]
struct Mail {
    id: i32,
    sender: i32,
    recipient: i32,
    title: String,
    body: String,
    images: String,
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::ftt_mail)]
struct NewMail<'a> {
    sender: i32,
    recipient: i32,
    title: &'a str,
    body: &'a str,
    images: &'a str,
}

fn connection(db: &mut DatabaseInitializer) -> &mut PgConnection {
    db.connection
        .as_mut()
        .expect("Database connection is not established")
}

fn discussion_marker(discussion_id: i32) -> String {
    format!("discussion:{}", discussion_id)
}

fn public_post(post: Post) -> crate::users::DiscussionPostInfo {
    let images = if post.images.starts_with("discussion:") {
        String::new()
    } else {
        post.images
    };

    crate::users::DiscussionPostInfo {
        id: post.id,
        author: post.author,
        name: post.name,
        perex: post.perex,
        body: post.body,
        images,
    }
}

fn public_mail(mail: Mail) -> crate::users::MailInfo {
    crate::users::MailInfo {
        id: mail.id,
        sender: mail.sender,
        recipient: mail.recipient,
        title: mail.title,
        body: mail.body,
        images: mail.images,
    }
}

fn discussion_with_posts(
    conn: &mut PgConnection,
    discussion: Discussion,
) -> Result<crate::users::DiscussionInfo, diesel::result::Error> {
    use crate::schema::ftt_posts::dsl as posts;

    let thread_posts = posts::ftt_posts
        .filter(posts::images.eq(discussion_marker(discussion.id)))
        .order(posts::id.asc())
        .select(Post::as_select())
        .load::<Post>(conn)?;

    Ok(crate::users::DiscussionInfo {
        id: discussion.id,
        n_posts: discussion.n_posts.max(thread_posts.len() as i32),
        name: discussion.name,
        info: discussion.info,
        image: discussion.image,
        posts: thread_posts.into_iter().map(public_post).collect(),
    })
}

fn list_discussions_in_db(
    db: &mut DatabaseInitializer,
) -> Result<Vec<crate::users::DiscussionInfo>, diesel::result::Error> {
    use crate::schema::ftt_discussions::dsl as discussions;

    let conn = connection(db);
    let rows = discussions::ftt_discussions
        .order(discussions::id.asc())
        .select(Discussion::as_select())
        .load::<Discussion>(conn)?;

    rows.into_iter()
        .map(|discussion| discussion_with_posts(conn, discussion))
        .collect()
}

fn get_discussion_in_db(
    db: &mut DatabaseInitializer,
    discussion_id: i32,
) -> Result<Option<crate::users::DiscussionInfo>, diesel::result::Error> {
    use crate::schema::ftt_discussions::dsl as discussions;

    let conn = connection(db);
    let row = discussions::ftt_discussions
        .filter(discussions::id.eq(discussion_id))
        .select(Discussion::as_select())
        .first::<Discussion>(conn)
        .optional()?;

    row.map(|discussion| discussion_with_posts(conn, discussion))
        .transpose()
}

fn create_discussion_in_db(
    db: &mut DatabaseInitializer,
    new_discussion: &CreateDiscussion,
    author_id: i32,
) -> Result<crate::users::DiscussionInfo, diesel::result::Error> {
    use crate::schema::ftt_discussions::dsl as discussions;
    use crate::schema::ftt_posts::dsl as posts;

    let conn = connection(db);
    conn.transaction(|conn| {
        let inserted_discussion = diesel::insert_into(discussions::ftt_discussions)
            .values(&NewDiscussion {
                name: &new_discussion.name,
                info: &new_discussion.info,
                image: "",
            })
            .returning(Discussion::as_returning())
            .get_result::<Discussion>(conn)?;

        let marker = discussion_marker(inserted_discussion.id);
        diesel::insert_into(posts::ftt_posts)
            .values(&NewPost {
                author: author_id,
                name: "first post",
                perex: &new_discussion.info,
                body: &new_discussion.info,
                images: &marker,
            })
            .execute(conn)?;

        let updated_discussion = diesel::update(
            discussions::ftt_discussions.filter(discussions::id.eq(inserted_discussion.id)),
        )
        .set(discussions::n_posts.eq(1))
        .returning(Discussion::as_returning())
        .get_result::<Discussion>(conn)?;

        discussion_with_posts(conn, updated_discussion)
    })
}

fn create_post_in_db(
    db: &mut DatabaseInitializer,
    discussion_id: i32,
    new_post: &CreatePost,
    author_id: i32,
) -> Result<crate::users::DiscussionInfo, diesel::result::Error> {
    use crate::schema::ftt_discussions::dsl as discussions;
    use crate::schema::ftt_posts::dsl as posts;

    let conn = connection(db);
    conn.transaction(|conn| {
        let discussion = discussions::ftt_discussions
            .filter(discussions::id.eq(discussion_id))
            .select(Discussion::as_select())
            .first::<Discussion>(conn)?;

        let marker = discussion_marker(discussion.id);
        diesel::insert_into(posts::ftt_posts)
            .values(&NewPost {
                author: author_id,
                name: "reply",
                perex: "",
                body: &new_post.body,
                images: &marker,
            })
            .execute(conn)?;

        let updated_discussion =
            diesel::update(discussions::ftt_discussions.filter(discussions::id.eq(discussion.id)))
                .set(discussions::n_posts.eq(discussions::n_posts + 1))
                .returning(Discussion::as_returning())
                .get_result::<Discussion>(conn)?;

        discussion_with_posts(conn, updated_discussion)
    })
}

fn list_mail_in_db(
    db: &mut DatabaseInitializer,
    user_id: i32,
) -> Result<Vec<crate::users::MailInfo>, diesel::result::Error> {
    use crate::schema::ftt_mail::dsl as mail;

    let rows = mail::ftt_mail
        .filter(mail::sender.eq(user_id).or(mail::recipient.eq(user_id)))
        .order(mail::id.asc())
        .select(Mail::as_select())
        .load::<Mail>(connection(db))?;

    Ok(rows.into_iter().map(public_mail).collect())
}

fn get_mail_in_db(
    db: &mut DatabaseInitializer,
    mail_id: i32,
) -> Result<Option<crate::users::MailInfo>, diesel::result::Error> {
    use crate::schema::ftt_mail::dsl as mail;

    let row = mail::ftt_mail
        .filter(mail::id.eq(mail_id))
        .select(Mail::as_select())
        .first::<Mail>(connection(db))
        .optional()?;

    Ok(row.map(public_mail))
}

fn create_mail_in_db(
    db: &mut DatabaseInitializer,
    new_mail: &CreateMail,
    sender_id: i32,
    recipient_id: i32,
) -> Result<crate::users::MailInfo, diesel::result::Error> {
    use crate::schema::ftt_mail::dsl as mail;

    let row = diesel::insert_into(mail::ftt_mail)
        .values(&NewMail {
            sender: sender_id,
            recipient: recipient_id,
            title: &new_mail.title,
            body: &new_mail.body,
            images: "",
        })
        .returning(Mail::as_returning())
        .get_result::<Mail>(connection(db))?;

    Ok(public_mail(row))
}

fn find_user_id_by_name(
    db: &mut DatabaseInitializer,
    user_name: &str,
) -> Result<Option<i32>, diesel::result::Error> {
    use crate::schema::ftt_users::dsl as users;

    users::ftt_users
        .filter(users::name.eq(user_name))
        .select(users::id)
        .first::<i32>(connection(db))
        .optional()
}

/*#[secured("ADMIN")]
#[get("/admin")]
async fn admin(user: AuthenticatedUser) -> impl Responder {
    HttpResponse::Ok().body(format!("Welcome, Admin {}!", user.get_username()))
}

#[pre_authorize("hasRole('USER') AND hasAuthority('posts:write')")]
#[post("/posts")]
async fn create_post(user: AuthenticatedUser) -> impl Responder {
    HttpResponse::Created().body("Post created")
}*/

#[get("/show")]
pub async fn show_users(pool: web::Data<Mutex<DatabaseInitializer>>) -> impl Responder {
    let mut db = pool.lock().unwrap();
    match list_users_in_db(&mut db) {
        Ok(users) => HttpResponse::Ok().json(users),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not load users: {}", err),
        })),
    }
}

// pub fn create_authenticator(pool: web::Data<Argon2PasswordEncoder>) -> MemoryAuthenticator {
//     let encoder = pool.get_ref();
//     AuthenticationManager::in_memory_authentication()
//         .password_encoder(encoder.clone())
//         .with_user(
//             User::with_encoded_password("admin", encoder.encode("admin"))
//                 .roles(&["ADMIN".into(), "USER".into()])
//                 .authorities(&["posts:write".into()])
//         )
// }
//
// // Factory function: URL-based authorization rules
// pub fn create_authorizer() -> RequestMatcherAuthorizer {
//     AuthorizationManager::request_matcher()
//         .http_basic()
//         .add_matcher("/users/login", Access::new().roles(vec!["ADMIN"]))
//     // add more matchers per route as needed
// }

#[post("/login")]
pub async fn login_user(
    pool: web::Data<Mutex<DatabaseInitializer>>,
    body: web::Json<LoginUser>,
) -> impl Responder {
    let mut db = pool.lock().unwrap();
    match login_user_in_db(&mut db, &body) {
        Ok(Some(user)) => HttpResponse::Ok().json(user),
        Ok(None) => HttpResponse::Unauthorized().json(serde_json::json!({
            "message": "Name or password is incorrect.",
        })),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not log in: {}", err),
        })),
    }
}

#[post("/create")]
pub async fn create_user(
    pool: web::Data<Mutex<DatabaseInitializer>>,
    encoder: web::Data<Argon2PasswordEncoder>,
    body: web::Json<CreateUser>
) -> impl Responder {
    let mut db = pool.lock().expect("create_user expect DatabaseInitializer");
    match create_user_in_db(&mut db, &body, encoder.get_ref()) {
        Ok(_) => {
            let encoded = encoder.encode(&body.password);
            let auth_user = User::with_encoded_password(&body.name, encoded)
                .roles(&["USER".into()]);
            register_user(auth_user);

            HttpResponse::Created().json(serde_json::json!({
                "success": true,
                "message": format!("Created user: {}", body.name),
                "email": body.email,
            }))
        }
        Err(err) => {
            let error = match err {
                CreateUserError::DatabaseError(e) => e.to_string(),
                CreateUserError::AlreadyExists => "User already exists".to_string()
            };
            HttpResponse::ExpectationFailed().json(serde_json::json!({
                "success": false,
                "message": format!("Creation of user failed: {}", error),
                "email": body.email,
            }))
        }
    }
}

#[get("/show/{id}")]
pub async fn user_detail(
    pool: web::Data<Mutex<DatabaseInitializer>>,
    path: web::Path<(i32,)>,
) -> impl Responder {
    let mut db = pool.lock().unwrap();
    let user_id = path.into_inner().0;

    match get_user_in_db(&mut db, user_id) {
        Ok(Some(user)) => HttpResponse::Ok().json(user),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "message": format!("User {} was not found.", user_id),
        })),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not load user {}: {}", user_id, err),
        })),
    }
}

#[get("/show")]
pub async fn show_discussions(pool: web::Data<Mutex<DatabaseInitializer>>) -> impl Responder {
    let mut db = pool.lock().unwrap();
    match list_discussions_in_db(&mut db) {
        Ok(discussions) => HttpResponse::Ok().json(discussions),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not load discussions: {}", err),
        })),
    }
}

#[get("/show/{id}")]
pub async fn discussion_detail(
    pool: web::Data<Mutex<DatabaseInitializer>>,
    path: web::Path<(i32,)>,
) -> impl Responder {
    let mut db = pool.lock().unwrap();
    let discussion_id = path.into_inner().0;

    match get_discussion_in_db(&mut db, discussion_id) {
        Ok(Some(discussion)) => HttpResponse::Ok().json(discussion),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "message": format!("Discussion {} was not found.", discussion_id),
        })),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not load discussion {}: {}", discussion_id, err),
        })),
    }
}

#[post("/create")]
pub async fn create_discussion(
    pool: web::Data<Mutex<DatabaseInitializer>>,
    body: web::Json<CreateDiscussion>,
) -> impl Responder {
    let author_id = match body.author {
        Some(author_id) => author_id,
        None => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "message": "Discussion author is required.",
            }))
        }
    };

    if body.name.trim().is_empty() || body.info.trim().is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "message": "Discussion title and body are required.",
        }));
    }

    let mut db = pool.lock().unwrap();
    match create_discussion_in_db(&mut db, &body, author_id) {
        Ok(discussion) => HttpResponse::Created().json(discussion),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not create discussion: {}", err),
        })),
    }
}

#[post("/{id}/posts")]
pub async fn create_discussion_post(
    pool: web::Data<Mutex<DatabaseInitializer>>,
    path: web::Path<(i32,)>,
    body: web::Json<CreatePost>,
) -> impl Responder {
    let author_id = match body.author {
        Some(author_id) => author_id,
        None => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "message": "Post author is required.",
            }))
        }
    };

    if body.body.trim().is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "message": "Post body is required.",
        }));
    }

    let mut db = pool.lock().unwrap();
    match create_post_in_db(&mut db, path.into_inner().0, &body, author_id) {
        Ok(discussion) => HttpResponse::Created().json(discussion),
        Err(diesel::result::Error::NotFound) => HttpResponse::NotFound().json(serde_json::json!({
            "message": "Discussion was not found.",
        })),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not create post: {}", err),
        })),
    }
}

#[get("/show")]
pub async fn show_mail(
    pool: web::Data<Mutex<DatabaseInitializer>>,
    query: web::Query<MailQuery>,
) -> impl Responder {
    let user_id = match query.user_id {
        Some(user_id) => user_id,
        None => return HttpResponse::Ok().json(serde_json::json!([])),
    };

    let mut db = pool.lock().unwrap();
    match list_mail_in_db(&mut db, user_id) {
        Ok(mail) => HttpResponse::Ok().json(mail),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not load mail: {}", err),
        })),
    }
}

#[get("/show/{id}")]
pub async fn mail_detail(
    pool: web::Data<Mutex<DatabaseInitializer>>,
    path: web::Path<(i32,)>,
) -> impl Responder {
    let mut db = pool.lock().unwrap();
    let mail_id = path.into_inner().0;

    match get_mail_in_db(&mut db, mail_id) {
        Ok(Some(mail)) => HttpResponse::Ok().json(mail),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "message": format!("Mail {} was not found.", mail_id),
        })),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not load mail {}: {}", mail_id, err),
        })),
    }
}

#[post("/create")]
pub async fn create_mail(
    pool: web::Data<Mutex<DatabaseInitializer>>,
    body: web::Json<CreateMail>,
) -> impl Responder {
    let sender_id = match body.sender {
        Some(sender_id) => sender_id,
        None => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "message": "Mail sender is required.",
            }))
        }
    };

    if body.title.trim().is_empty() || body.body.trim().is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "message": "Mail title and body are required.",
        }));
    }

    let mut db = pool.lock().unwrap();
    let recipient_id = match (body.recipient, body.to.as_deref()) {
        (Some(recipient_id), _) => recipient_id,
        (None, Some(to)) => match find_user_id_by_name(&mut db, to) {
            Ok(Some(recipient_id)) => recipient_id,
            Ok(None) => {
                return HttpResponse::NotFound().json(serde_json::json!({
                    "message": format!("Recipient {} was not found.", to),
                }))
            }
            Err(err) => {
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "message": format!("Could not resolve recipient: {}", err),
                }))
            }
        },
        (None, None) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "message": "Mail recipient is required.",
            }))
        }
    };

    match create_mail_in_db(&mut db, &body, sender_id, recipient_id) {
        Ok(mail) => HttpResponse::Created().json(mail),
        Err(err) => HttpResponse::InternalServerError().json(serde_json::json!({
            "message": format!("Could not create mail: {}", err),
        })),
    }
}

#[get("/show")]
pub async fn show_games() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!([]))
}

#[get("/show/{id}")]
pub async fn game_detail(path: web::Path<(u32,)>) -> impl Responder {
    HttpResponse::NotFound().json(serde_json::json!({
        "message": format!("Game {} is not installed yet.", path.into_inner().0),
    }))
}
