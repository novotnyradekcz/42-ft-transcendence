-- ftt_users
CREATE TABLE ftt_users (
    id         SERIAL PRIMARY KEY,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL
);

-- ftt_mail
CREATE TABLE ftt_mail (
    id         SERIAL PRIMARY KEY,
    sender     INTEGER NOT NULL REFERENCES ftt_users(id),
    recipient  INTEGER NOT NULL REFERENCES ftt_users(id),
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    images     TEXT NOT NULL
);

-- ftt_discussions
CREATE TABLE ftt_discussions (
    id       SERIAL PRIMARY KEY,
    n_posts  INTEGER NOT NULL DEFAULT 0,
    name     TEXT NOT NULL,
    info     TEXT NOT NULL,
    image    TEXT NOT NULL
);

-- ftt_posts
CREATE TABLE ftt_posts (
    id      SERIAL PRIMARY KEY,
    author  INTEGER NOT NULL REFERENCES ftt_users(id),
    name    TEXT NOT NULL,
    perex   TEXT NOT NULL,
    body    TEXT NOT NULL,
    images  TEXT NOT NULL
);

-- ftt_games
CREATE TABLE ftt_games (
    id      SERIAL PRIMARY KEY,
    author  INTEGER NOT NULL REFERENCES ftt_users(id),
    name    TEXT NOT NULL,
    body    TEXT NOT NULL
);
