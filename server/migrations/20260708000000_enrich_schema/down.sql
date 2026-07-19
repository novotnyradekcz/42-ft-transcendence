-- ftt_posts: remove discussion_id
ALTER TABLE ftt_posts DROP COLUMN IF EXISTS discussion_id;

-- ftt_users: remove added columns
ALTER TABLE ftt_users DROP COLUMN IF EXISTS friends;
ALTER TABLE ftt_users DROP COLUMN IF EXISTS avatar_url;
ALTER TABLE ftt_users DROP COLUMN IF EXISTS bio;

