CREATE TABLE ftt_achievements (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    emoji VARCHAR(8) NOT NULL
);

CREATE TABLE ftt_player_achievements (
    user_id INTEGER NOT NULL REFERENCES ftt_users(id) ON DELETE CASCADE,
    achievement_id INTEGER NOT NULL REFERENCES ftt_achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX idx_ftt_player_achievements_user ON ftt_player_achievements(user_id);

INSERT INTO ftt_achievements (id, name, description, emoji) VALUES
(1, 'Playa', 'Play your first game', '🎮'),
(2, 'Winner', 'Win your first game', '🥇'),
(3, 'No shame in losing', 'Lose your first game', '🩹'),
(4, 'Serial playa', 'Play 3 games', '🕹️'),
(5, 'Serial winner', 'Win 3 games', '🏆'),
(6, 'It builds character', 'Lose 3 games', '🗿'),
(7, 'Big Playa', 'Play 10 games', '👑'),
(8, 'Big Winner', 'Win 10 games', '💎'),
(9, 'They must be cheating', 'Lose 10 games', '🧂');
