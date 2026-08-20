# New feature: game achievements

Certian actions the players do will trigger an achievemnt. The achievements will be displayed in a separate achievements page accessible from the games page (similar to how the player rcan access their history). The page will show all achievemnts, the ones the player has unocked will be highlighted, with the date of unlocking displayed. The others will be grayed out. Each achievement will have a small description of what the player needs to do to unlock it.


## Achievements table
```
-- 1. Player Table
-- Already exists - ftt_users table.


-- 2. Achievements Table (Definitions)
CREATE TABLE ftt_achievements (
    achievement_id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL
    emoji VARCHAR(8) NOT NULL
);

-- 3. Junction Table (Associates Players with Achievements)
CREATE TABLE ftt_player_achievements (
    player_id INT REFERENCES ftt_users(id) ON DELETE CASCADE,
    achievement_id INT REFERENCES ftt_achievements(achievement_id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (player_id, achievement_id)
);
```

Each achievement has an emoji associated with it. This emoji will be displayed next to the achievemnt name on the achievements page. The emojis of the latest three achievemnts of each player will alos be displayed next to their name on the game leaderboard.


## Achievements list

| Id | Name | Description | Emoji |
|----|------|-------------|-------|
| 1 | Playa | Play your first game | 🎮 |
| 2 | Winner | Win your first game | 🥇 |
| 3 | No shame in losing | Lose your first game | 🩹 |
| 4 | Serial playa | Play 3 games | 🕹️ |
| 5 | Serial winner | Win 3 games | 🏆 |
| 6 | It builds character | Lose 3 games | 🗿 |
| 7 | Big Playa | Play 10 games | 👑 |
| 8 | Big Winner | Win 10 games | 💎 |
| 9 | They must be cheating | Lose 10 games | 🧂 |


## Unlocking achievements

As each achievemnt is tied to the result of a game, they will be unlocked when finishing a game. More than one achievemnt can be unocked at the same time, e.g. Winner and Playa. Since they are all dependent on the number of games played and won/lost, this info will be retrieved from ftt_game_history. The same achievemnt cannot be unlocked multiple times. This will be checked for both players in a game, so e.g. if A and B play, both A and B may unlock achievements. When a player finishes a game which unlocks an acievemnts, the achievemnt emoji, name and description will be shown on the screen, e. g. You have unlocked 'Winner 🥇' - Win your first game.


