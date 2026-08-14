DROP INDEX IF EXISTS ftt_users_provider_idx;
ALTER TABLE ftt_users DROP COLUMN provider_user_id;
ALTER TABLE ftt_users DROP COLUMN provider;
