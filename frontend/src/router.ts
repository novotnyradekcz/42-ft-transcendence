// url to page mapping, in its own file so providers can import it
// without tripping the only-export-components lint rule
import type { Page } from "./types";

// path for every page
export const PAGE_PATHS: Record<Page, string> = {
  welcome: "/",
  home: "/menu",
  help: "/help",
  privacy: "/privacy",
  terms: "/terms",
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
  "game-history": "/games/history",
  "game-leaderboard": "/games/leaderboard",
};

// the page one level up from each page, `back` walks this instead of history
// pages missing here are roots
export const PAGE_PARENTS: Partial<Record<Page, Page>> = {
  help: "home",
  privacy: "home",
  terms: "home",
  users: "home",
  "user-detail": "users",
  friends: "home",
  profile: "home",
  discussions: "home",
  "discussion-detail": "discussions",
  mail: "home",
  "mail-detail": "mail",
  games: "home",
  "game-play": "games",
  "game-history": "games",
  "game-leaderboard": "games",
};

// where `back` lands from a page, null when there's nowhere to go
export function parentPath(page: Page, isLoggedIn: boolean): string | null {
  const parent = PAGE_PARENTS[page];
  if (!parent) return null;
  if (!isLoggedIn) return PAGE_PATHS.welcome;
  return PAGE_PATHS[parent];
}

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
  if (pathname === "/games/history") return "game-history";
  if (pathname === "/games/leaderboard") return "game-leaderboard";
  if (pathname === "/games/show") return "games";
  if (pathname === "/help") return "help";
  if (pathname === "/privacy") return "privacy";
  if (pathname === "/terms") return "terms";
  if (pathname === "/users/me") return "profile";
  if (pathname === "/users/login") return "login";
  if (pathname === "/users/create") return "register";
  return "welcome";
}
