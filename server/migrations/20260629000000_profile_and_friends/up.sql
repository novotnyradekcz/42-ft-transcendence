-- Move frontend localStorage state into the database:
-- profile overrides (bio/avatar) become real columns, friendships get their own table.

ALTER TABLE ftt_users ADD COLUMN bio TEXT NOT NULL DEFAULT 'No profile info yet.';
ALTER TABLE ftt_users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT '/images/profile.png';

CREATE TABLE ftt_friends (
    user_id   INTEGER NOT NULL REFERENCES ftt_users(id),
    friend_id INTEGER NOT NULL REFERENCES ftt_users(id),
    PRIMARY KEY (user_id, friend_id)
);
