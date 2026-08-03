CREATE TABLE ftt_token_blacklist (
    id          SERIAL PRIMARY KEY,
    token_key   TEXT   NOT NULL UNIQUE,
    expires_at  BIGINT NOT NULL
);
