-- ftt_posts: remove discussion_id
ALTER TABLE ftt_posts DROP COLUMN discussion_id;

-- ftt_users: remove added columns
ALTER TABLE ftt_users DROP COLUMN friends;
ALTER TABLE ftt_users DROP COLUMN avatar_url;
ALTER TABLE ftt_users DROP COLUMN bio;
