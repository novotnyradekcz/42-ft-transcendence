// @generated automatically by Diesel CLI.

diesel::table! {
    ftt_discussions (id) {
        id -> Int4,
        n_posts -> Int4,
        name -> Text,
        info -> Text,
        image -> Text,
    }
}

diesel::table! {
    ftt_games (id) {
        id -> Int4,
        author -> Int4,
        name -> Text,
        body -> Text,
    }
}

diesel::table! {
    ftt_mail (id) {
        id -> Int4,
        sender -> Int4,
        recipient -> Int4,
        title -> Text,
        body -> Text,
        images -> Text,
    }
}

diesel::table! {
    ftt_posts (id) {
        id -> Int4,
        author -> Int4,
        name -> Text,
        perex -> Text,
        body -> Text,
        images -> Text,
    }
}

diesel::table! {
    ftt_users (id) {
        id -> Int4,
        name -> Text,
        email -> Text,
        password -> Text,
        bio -> Text,
        avatar_url -> Text,
    }
}

diesel::table! {
    ftt_friends (user_id, friend_id) {
        user_id -> Int4,
        friend_id -> Int4,
    }
}

diesel::joinable!(ftt_games -> ftt_users (author));
diesel::joinable!(ftt_posts -> ftt_users (author));

diesel::allow_tables_to_appear_in_same_query!(
    ftt_discussions,
    ftt_friends,
    ftt_games,
    ftt_mail,
    ftt_posts,
    ftt_users,
);
