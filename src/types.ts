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
  | "games";

export type UserProfile = {
  id: number;
  name: string;
  email: string;
};

export type SessionUser = Pick<UserProfile, "id" | "name" | "email">;

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
