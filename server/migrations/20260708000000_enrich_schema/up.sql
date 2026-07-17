-- ftt_users: add bio, avatar_url, friends
ALTER TABLE ftt_users ADD COLUMN bio        TEXT NOT NULL DEFAULT '';
ALTER TABLE ftt_users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT '';
ALTER TABLE ftt_users ADD COLUMN friends    TEXT NOT NULL DEFAULT '[]';

-- ftt_posts: link posts to a discussion thread
ALTER TABLE ftt_posts ADD COLUMN discussion_id INTEGER REFERENCES ftt_discussions(id);
