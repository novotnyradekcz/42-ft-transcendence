// The URL <-> page mapping, plus where the `back` command goes from each page.
//
// Only PAGE_PATHS is exhaustive — it's Record<Page, string>, so a new page
// won't compile until it has a path. The other two are on you. PAGE_PARENTS is
// partial on purpose (a page missing from it is a root), and pageFromPath() is
// a hand-written chain that quietly answers "welcome" for anything it doesn't
// recognise. Adding a page means checking both of those by hand.

// separate from the providers because a file exporting components can't also
// export plain values without tripping the only-export-components lint rule
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

// the reverse of PAGE_PATHS. detail pages share a prefix with their list page,
// so the longer /show/:id match has to be tested before the bare /show one.
// anything unrecognised falls back to the front page rather than erroring
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
