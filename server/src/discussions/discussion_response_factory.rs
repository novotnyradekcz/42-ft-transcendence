// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

//! Builds the `DiscussionInfo` payload — a discussion plus the posts belonging to
//! it, gathered by the `discussion:<id>` marker rather than by a foreign key.

use diesel::prelude::*;
use diesel::result::Error;
use crate::discussions::DiscussionInfo;
use crate::model::database_initializer;
use crate::model::database_initializer::DatabaseInitializer;
use crate::model::discussions::Discussion;
use crate::model;

// one discussion, with its posts. n_posts is taken as the larger of the stored
// counter and the posts actually found, so a drifted counter under-reports rather
// than hiding a post
pub fn create_discussion_response_factory(conn: &mut PgConnection, discussion: Discussion) -> Result<DiscussionInfo, Error> {
    use crate::schema::ftt_posts::dsl as posts;
    use crate::discussions;
    use crate::model::discussions::Post;
    let thread_posts = posts::ftt_posts
        .filter(posts::images.eq(discussions::discussion_marker(discussion.get_id())))
        .order(posts::id.asc())
        .select(Post::as_select())
        .load::<Post>(conn)?;

    Ok(DiscussionInfo {
        id: discussion.get_id(),
        n_posts: discussion.get_n_posts().max(thread_posts.len() as i32),
        name: discussion.get_name(),
        info: discussion.get_info(),
        image: discussion.get_image(),
        posts: thread_posts
            .into_iter()
            .map(discussions::public_post)
            .collect(),
    })
}

// every discussion, each with its posts loaded — so this is one query per thread,
// not one query overall.
//
// note the `.unwrap()` below: a database error while loading a single thread's
// posts panics the worker rather than propagating, even though this function
// returns a Result and could carry it
pub fn create_response_list_discussions(db: &mut DatabaseInitializer) -> Result<Vec<DiscussionInfo>, Error> {
    let conn = database_initializer::connection(db);
    use crate::schema::ftt_discussions::dsl as discussions;
    let rows = discussions::ftt_discussions
        .order(discussions::id.asc())
        .select(Discussion::as_select())
        .load::<Discussion>(conn)?;

    Ok(rows.into_iter()
        .map(|discussion| model::discussions::discussion_with_posts(conn, discussion).unwrap())
        .collect())
}