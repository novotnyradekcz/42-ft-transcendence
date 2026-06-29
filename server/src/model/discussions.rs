use diesel::prelude::*;
use diesel::result::Error;
use crate::discussions::{CreateDiscussion, CreatePost, DiscussionInfo};
use crate::model::database_initializer::DatabaseInitializer;

#[derive(Queryable, Selectable)]
#[diesel(table_name = crate::schema::ftt_discussions)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Discussion {
    id: i32,
    n_posts: i32,
    name: String,
    info: String,
    image: String,
}

impl Discussion {
    pub fn get_id(&self) -> i32 {
        self.id
    }

    pub fn get_n_posts(&self) -> i32 {
        self.n_posts
    }

    pub fn get_name(&self) -> String {
        self.name.clone()
    }

    pub fn get_info(&self) -> String {
        self.info.clone()
    }

    pub fn get_image(&self) -> String {
        self.image.clone()
    }
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::ftt_discussions)]
pub struct NewDiscussion<'a> {
    name: &'a str,
    info: &'a str,
    image: &'a str,
}

impl<'a> NewDiscussion<'a> {
    pub fn new(name: &'a str, info: &'a str, image: &'a str) -> Self {
        NewDiscussion { name, info, image }
    }

    pub fn get_name(&self) -> &str {
        self.name
    }

    pub fn get_info(&self) -> &str {
        self.info
    }

    pub fn get_image(&self) -> &str {
        self.image
    }
}

#[derive(Queryable, Selectable)]
#[diesel(table_name = crate::schema::ftt_posts)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct Post {
    id: i32,
    author: i32,
    name: String,
    perex: String,
    body: String,
    images: String,
}

impl Post {
    pub fn get_id(&self) -> i32 {
        self.id
    }

    pub fn get_author(&self) -> i32 {
        self.author
    }

    pub fn get_name(&self) -> String {
        self.name.clone()
    }

    pub fn get_perex(&self) -> String {
        self.perex.clone()
    }

    pub fn get_body(&self) -> String {
        self.body.clone()
    }

    pub fn get_images(&self) -> String {
        self.images.clone()
    }
}

#[derive(Insertable)]
#[diesel(table_name = crate::schema::ftt_posts)]
pub struct NewPost<'a> {
    author: i32,
    name: &'a str,
    perex: &'a str,
    body: &'a str,
    images: &'a str,
}

impl<'a> NewPost<'a> {
    pub fn new(author: i32, name: &'a str, perex: &'a str, body: &'a str, images: &'a str) -> Self {
        NewPost {
            author,
            name,
            perex,
            body,
            images,
        }
    }

    pub fn get_author(&self) -> i32 {
        self.author
    }

    pub fn get_name(&self) -> &str {
        self.name
    }

    pub fn get_perex(&self) -> &str {
        self.perex
    }

    pub fn get_body(&self) -> &str {
        self.body
    }

    pub fn get_images(&self) -> &str {
        self.images
    }
}

pub fn discussion_with_posts(
    conn: &mut PgConnection,
    discussion: Discussion,
) -> Result<DiscussionInfo, Error> {
    use crate::discussions::discussion_response_factory;

    discussion_response_factory::create_discussion_response_factory(conn, discussion)
}

pub fn list_discussions_in_db(
    db: &mut DatabaseInitializer,
) -> Result<Vec<DiscussionInfo>, Error> {
    use crate::discussions::discussion_response_factory;

    discussion_response_factory::create_response_list_discussions(db)
}

pub fn get_discussion_in_db(
    db: &mut DatabaseInitializer,
    discussion_id: i32,
) -> Result<Option<crate::discussions::DiscussionInfo>, diesel::result::Error> {
    use crate::model::database_initializer;
    use crate::schema::ftt_discussions::dsl as discussions;

    let conn = database_initializer::connection(db);
    let row = discussions::ftt_discussions
        .filter(discussions::id.eq(discussion_id))
        .select(Discussion::as_select())
        .first::<Discussion>(conn)
        .optional()?;

    row.map(|discussion| discussion_with_posts(conn, discussion))
        .transpose()
}

pub fn create_discussion_in_db(
    db: &mut DatabaseInitializer,
    new_discussion: &CreateDiscussion,
    author_id: i32,
) -> Result<crate::discussions::DiscussionInfo, diesel::result::Error> {
    use crate::discussions;
    use crate::model::database_initializer;
    use crate::model::discussions::{NewDiscussion, NewPost};
    use crate::schema::ftt_discussions::dsl as discussions_model;
    use crate::schema::ftt_posts::dsl as posts_model;

    let conn = database_initializer::connection(db);
    conn.transaction(|conn| {
        let inserted_discussion = diesel::insert_into(discussions_model::ftt_discussions)
            .values(&NewDiscussion::new(
                new_discussion.name.as_str(),
                new_discussion.info.as_str(),
                "",
            ))
            .returning(Discussion::as_returning())
            .get_result::<Discussion>(conn)?;

        let marker = discussions::discussion_marker(inserted_discussion.get_id());
        diesel::insert_into(posts_model::ftt_posts)
            .values(&NewPost::new(
                author_id,
                "first post",
                &new_discussion.info,
                &new_discussion.info,
                &marker,
            ))
            .execute(conn)?;

        let updated_discussion = diesel::update(
            discussions_model::ftt_discussions
                .filter(discussions_model::id.eq(inserted_discussion.get_id())),
        )
        .set(discussions_model::n_posts.eq(1))
        .returning(Discussion::as_returning())
        .get_result::<Discussion>(conn)?;

        discussion_with_posts(conn, updated_discussion)
    })
}

pub fn create_post_in_db(
    db: &mut DatabaseInitializer,
    discussion_id: i32,
    new_post: &CreatePost,
    author_id: i32,
) -> Result<crate::discussions::DiscussionInfo, diesel::result::Error> {
    use crate::discussions;
    use crate::model::database_initializer;
    use crate::schema::ftt_discussions::dsl as discussions_model;
    use crate::schema::ftt_posts::dsl as posts_model;

    let conn = database_initializer::connection(db);
    conn.transaction(|conn| {
        let discussion = discussions_model::ftt_discussions
            .filter(discussions_model::id.eq(discussion_id))
            .select(Discussion::as_select())
            .first::<Discussion>(conn)?;

        let marker = discussions::discussion_marker(discussion.get_id());
        diesel::insert_into(posts_model::ftt_posts)
            .values(&NewPost::new(
                author_id,
                "reply",
                "",
                &new_post.body,
                &marker,
            ))
            .execute(conn)?;

        let updated_discussion = diesel::update(
            discussions_model::ftt_discussions
                .filter(discussions_model::id.eq(discussion.get_id())),
        )
        .set(discussions_model::n_posts.eq(discussions_model::n_posts + 1))
        .returning(Discussion::as_returning())
        .get_result::<Discussion>(conn)?;

        discussion_with_posts(conn, updated_discussion)
    })
}