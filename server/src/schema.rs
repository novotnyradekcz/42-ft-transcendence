// Copyright (c) 2026, ft_transcendence (https://42.fr) and/or its affiliates. All rights reserved

diesel::table! {
    ftt_users (id) {
        id -> Int4,
        name -> Text,
        email -> Text,
        password -> Text,
    }
}
