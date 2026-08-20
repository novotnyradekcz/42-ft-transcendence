// Shapes shared across the app. The server payloads these come from are looser
// than this — snake_case, optional fields, occasional nulls — so nothing here
// is trusted until it has been through a normalize* function in api.ts.

// every screen the board has. router.ts maps these to and from URLs, commands.ts
// keys the per-page command lists off them, and DataContext keys the per-page
// resource lists off them — so adding a page here makes all three fail to
// compile until they're updated, which is the point.
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
  | "game-leaderboard";

// a board member as the UI needs them: ids resolved, avatar always populated,
// friends always an array
export type UserProfile = {
  id: number;
  name: string;
  email: string;
  bio: string;
  avatarUrl: string;
  status: "online" | "offline";
  friends: number[];
};

// the token pair exactly as /users/login and /users/refresh_token return it.
// expires_in is the access token's lifetime in seconds; the refresh token is
// retired by the server the moment it's spent, so there is only ever one live
// copy of this — see the refresh handling in api.ts.
export type JwtObject = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  token_type: string;
};

// The signed-in user is the same shape as anyone else; the alias exists so
// signatures say which one they mean. Keep it an alias rather than adding
// session-only fields — SessionContext stores this in sessionStorage, so
// anything added here is written to disk.
export type SessionUser = UserProfile;

export type DiscussionPost = {
  id: number;
  author: number;
  name: string;
  perex: string;
  body: string;
  images: string;
};

// nPosts is sent alongside posts because the list view needs the count without
// the bodies; on /discussions/show the posts array comes back empty
export type DiscussionThread = {
  id: number;
  nPosts: number;
  name: string;
  info: string;
  image: string;
  posts: DiscussionPost[];
};

// one message in either direction — /mail/show returns sent and received
// together, so the UI compares `sender` against the session to tell them apart
export type MailMessage = {
  id: number;
  sender: number;
  recipient: number;
  title: string;
  body: string;
  images: string;
};

// an uploaded game. `body` is the Lua source itself, which GamePlayPage feeds
// to wasmoon; the server only stores and relays it.
export type GameSummary = {
  id: number;
  author: number;
  name: string;
  body: string;
};

// one finished match. names are joined in server-side, so the history page
// needs no user list to render a row. winner_id is null for a draw
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

// one row of the standings, ranked and totalled by the server
export type LeaderboardItem = {
  rank: number;
  user_id: number;
  user_name: string;
  wins: number;
  losses: number;
  draws: number;
  win_loss_ratio: number;
};


// one row of the command table in commands.ts, and one row of the help page.
// `usage` doubles as the example shown to the user, so it carries a sample
// argument rather than a placeholder.
export type CommandDefinition = {
  command: string;
  aliases: string[];
  usage: string;
  description: string;
};
