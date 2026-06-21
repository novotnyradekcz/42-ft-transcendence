use diesel::prelude::*;

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

#[derive(Insertable)]
#[diesel(table_name = crate::schema::ftt_posts)]
pub struct NewPost<'a> {
    author: i32,
    name: &'a str,
    perex: &'a str,
    body: &'a str,
    images: &'a str,
}
