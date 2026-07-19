-- ftt_users: add bio, avatar_url, friends
ALTER TABLE ftt_users ADD COLUMN IF NOT EXISTS bio        TEXT NOT NULL DEFAULT '';
ALTER TABLE ftt_users ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';
ALTER TABLE ftt_users ADD COLUMN IF NOT EXISTS friends    TEXT NOT NULL DEFAULT '[]';

-- ftt_posts: link posts to a discussion thread
ALTER TABLE ftt_posts ADD COLUMN IF NOT EXISTS discussion_id INTEGER REFERENCES ftt_discussions(id);

