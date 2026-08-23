DROP INDEX IF EXISTS ftt_users_provider_idx;
ALTER TABLE ftt_users DROP COLUMN IF EXISTS provider;
ALTER TABLE ftt_users DROP COLUMN IF EXISTS provider_user_id;
