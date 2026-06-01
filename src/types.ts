export type Page =
  | "welcome"
  | "home"
  | "help"
  | "users"
  | "user-detail"
  | "login"
  | "register"
  | "profile"
  | "discussions"
  | "discussion-detail"
  | "mail"
  | "mail-detail"
  | "games"
  | "api";

export type UserProfile = {
  id: number;
  username: string;
  email: string;
  status: "online" | "away" | "offline";
  bio: string;
};

export type SessionUser = Pick<UserProfile, "id" | "username" | "email">;

export type RegisteredUser = UserProfile & {
  password: string;
};

export type DiscussionPost = {
  id: number;
  author: string;
  body: string;
  createdAt: string;
};

export type DiscussionThread = {
  id: number;
  title: string;
  author: string;
  createdAt: string;
  posts: DiscussionPost[];
};

export type MailMessage = {
  id: number;
  from: string;
  to: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export type GameSummary = {
  id: number;
  name: string;
  status: "coming-soon" | "available";
};

export type ApiRoute = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  description: string;
};

export type CommandDefinition = {
  command: string;
  aliases: string[];
  usage: string;
  description: string;
};
