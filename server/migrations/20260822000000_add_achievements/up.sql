-- ftt_users: add achievements column
ALTER TABLE ftt_users ADD COLUMN IF NOT EXISTS achievements TEXT NOT NULL DEFAULT '[]';
