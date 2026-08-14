ALTER TABLE ftt_users ADD COLUMN provider         TEXT NOT NULL DEFAULT '';
ALTER TABLE ftt_users ADD COLUMN provider_user_id TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX ftt_users_provider_idx
  ON ftt_users (provider, provider_user_id)
  WHERE provider <> '';
