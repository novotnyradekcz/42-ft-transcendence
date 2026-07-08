/**
 * URL ↔ Page mapping shared across the application.
 * Kept in a standalone file so context providers and components can import
 * routing helpers without triggering the react-refresh/only-export-components
 * lint rule (that rule requires component files to export only components).
 */
import type { Page } from "./types";

export const PAGE_PATHS: Record<Page, string> = {
  welcome: "/",
  home: "/menu",
  help: "/help",
  users: "/users/show",
  "user-detail": "/users/show",
  friends: "/friends/show",
  login: "/users/login",
  register: "/users/create",
  profile: "/users/me",
  discussions: "/discussions/show",
  "discussion-detail": "/discussions/show",
  mail: "/mail/show",
  "mail-detail": "/mail/show",
  games: "/games/show",
  "game-play": "/games/play",
};

export function pageFromPath(pathname: string): Page {
  if (pathname === "/" || pathname === "") return "welcome";
  if (pathname === "/menu") return "home";
  if (pathname.startsWith("/users/show/")) return "user-detail";
  if (pathname === "/users/show") return "users";
  if (pathname.startsWith("/friends/show")) return "friends";
  if (pathname.startsWith("/discussions/show/")) return "discussion-detail";
  if (pathname === "/discussions/show") return "discussions";
  if (pathname.startsWith("/mail/show/")) return "mail-detail";
  if (pathname === "/mail/show") return "mail";
  if (pathname.startsWith("/games/play")) return "game-play";
  if (pathname === "/games/show") return "games";
  if (pathname === "/help") return "help";
  if (pathname === "/users/me") return "profile";
  if (pathname === "/users/login") return "login";
  if (pathname === "/users/create") return "register";
  return "welcome";
}
