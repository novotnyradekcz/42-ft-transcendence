// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

use diesel::{PgConnection, SelectableHelper};
use diesel::result::Error;
use crate::discussions::DiscussionInfo;
use crate::model::database_initializer;
use crate::model::database_initializer::DatabaseInitializer;
use crate::model::discussions::Discussion;
use crate::router;

pub fn create_discussion_response_factory(conn: &mut PgConnection, discussion: Discussion) -> Result<DiscussionInfo, Error> {
    use diesel::SelectableHelper;
    use crate::discussions;
    use crate::model::discussions::Post;
    let thread_posts = posts::ftt_posts
        .filter(posts::images.eq(discussions::discussion_marker(discussion.get_id())))
        .order(posts::id.asc())
        .select(Post::as_select())
        .load::<Post>(conn)?;

    Ok(Ok(crate::discussions::DiscussionInfo {
        id: discussion.get_id(),
        n_posts: discussion.get_n_posts().max(thread_posts.len() as i32),
        name: discussion.get_name(),
        info: discussion.get_info(),
        image: discussion.get_image(),
        posts: thread_posts
            .into_iter()
            .map(discussions::public_post)
            .collect(),
    }))
}

pub fn create_response_list_discussions(db: &mut DatabaseInitializer) -> Result<Vec<DiscussionInfo>, Error> {
    let conn = database_initializer::connection(db);
    use crate::schema::ftt_discussions::dsl as discussions;
    let rows = discussions::ftt_discussions
        .order(discussions::id.asc())
        .select(Discussion::as_select())
        .load::<Discussion>(conn)?;

    Ok(rows.into_iter()
        .map(|discussion| router::discussion_with_posts(conn, discussion))
        .collect())
}