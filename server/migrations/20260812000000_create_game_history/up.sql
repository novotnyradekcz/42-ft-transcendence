CREATE TABLE ftt_game_history (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES ftt_games(id) ON DELETE CASCADE,
    game_name VARCHAR NOT NULL,
    player1_id INTEGER NOT NULL REFERENCES ftt_users(id) ON DELETE CASCADE,
    player2_id INTEGER NOT NULL REFERENCES ftt_users(id) ON DELETE CASCADE,
    winner_id INTEGER REFERENCES ftt_users(id) ON DELETE CASCADE,
    played_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ftt_game_history_player1 ON ftt_game_history(player1_id);
CREATE INDEX idx_ftt_game_history_player2 ON ftt_game_history(player2_id);
