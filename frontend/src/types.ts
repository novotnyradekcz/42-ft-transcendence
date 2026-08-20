export type Page =
  | "welcome"
  | "home"
  | "help"
  | "privacy"
  | "terms"
  | "users"
  | "user-detail"
  | "friends"
  | "login"
  | "register"
  | "profile"
  | "discussions"
  | "discussion-detail"
  | "mail"
  | "mail-detail"
  | "games"
  | "game-play"
  | "game-history"
  | "game-leaderboard"
  | "game-achievements";

export type UserProfile = {
  id: number;
  name: string;
  email: string;
  bio: string;
  avatarUrl: string;
  status: "online" | "offline";
  friends: number[];
};

export type JwtObject = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  token_type: string;
};

export type SessionUser = UserProfile;

export type DiscussionPost = {
  id: number;
  author: number;
  name: string;
  perex: string;
  body: string;
  images: string;
};

export type DiscussionThread = {
  id: number;
  nPosts: number;
  name: string;
  info: string;
  image: string;
  posts: DiscussionPost[];
};

export type MailMessage = {
  id: number;
  sender: number;
  recipient: number;
  title: string;
  body: string;
  images: string;
};

export type GameSummary = {
  id: number;
  author: number;
  name: string;
  body: string;
};

export type GameHistoryItem = {
  id: number;
  game_id: number;
  game_name: string;
  player1_id: number;
  player1_name: string;
  player2_id: number;
  player2_name: string;
  winner_id: number | null;
  winner_name: string | null;
  played_at: string;
};

export type LeaderboardItem = {
  rank: number;
  user_id: number;
  user_name: string;
  wins: number;
  losses: number;
  draws: number;
  win_loss_ratio: number;
  latest_achievements?: string[];
};

export type UserAchievement = {
  id: number;
  name: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  unlocked_at: string | null;
};

export type AchievementNotification = {
  id: number;
  name: string;
  description: string;
  emoji: string;
};


export type CommandDefinition = {
  command: string;
  aliases: string[];
  usage: string;
  description: string;
};
