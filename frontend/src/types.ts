export type Page =
  | "welcome"
  | "home"
  | "help"
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
  | "game-play";

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

export type CommandDefinition = {
  command: string;
  aliases: string[];
  usage: string;
  description: string;
};
