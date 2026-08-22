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
        discussion_id -> Nullable<Int4>,
        name -> Text,
        perex -> Text,
        body -> Text,
        images -> Text,
    }
}

diesel::table! {
    ftt_token_blacklist (id) {
        id -> Int4,
        token_key -> Text,
        expires_at -> Int8,
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
        friends -> Text,
        provider_user_id -> Text,
        provider -> Text,
        achievements -> Text,
    }
}

diesel::table! {
    ftt_game_history (id) {
        id -> Int4,
        game_id -> Int4,
        game_name -> Text,
        player1_id -> Int4,
        player2_id -> Int4,
        winner_id -> Nullable<Int4>,
        played_at -> Timestamp,
    }
}

diesel::joinable!(ftt_games -> ftt_users (author));
diesel::joinable!(ftt_posts -> ftt_users (author));
diesel::joinable!(ftt_posts -> ftt_discussions (discussion_id));
diesel::joinable!(ftt_game_history -> ftt_games (game_id));

diesel::allow_tables_to_appear_in_same_query!(
    ftt_discussions,
    ftt_game_history,
    ftt_games,
    ftt_mail,
    ftt_posts,
    ftt_token_blacklist,
    ftt_users,
);

