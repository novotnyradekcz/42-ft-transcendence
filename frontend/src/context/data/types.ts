// What DataProvider exposes: the board's collections, whichever item a page has
// open, and the calls that load them. `friends` is the odd one out — it's
// derived from the session user's id list, so nothing here fetches it.
//
// Loading is driven by the page being shown rather than by the commands that
// navigate there, so both calls below take a Page and work out the rest.

import type {
  DiscussionThread,
  GameSummary,
  MailMessage,
  Page,
  SessionUser,
  UserProfile,
} from "../../types";

// a server-backed collection the board pages render
export type DataResource = "discussions" | "games" | "mail" | "users";

export interface DataContextValue {
  discussions: DiscussionThread[];
  selectedDiscussion: DiscussionThread | null;
  mail: MailMessage[];
  selectedMail: MailMessage | null;
  games: GameSummary[];
  selectedGame: GameSummary | null;
  selectedUser: UserProfile | null;
  friends: UserProfile[];
  setSelectedDiscussion: (d: DiscussionThread | null) => void;
  setSelectedMail: (m: MailMessage | null) => void;
  setSelectedGame: (g: GameSummary | null) => void;
  setSelectedUser: (u: UserProfile | null) => void;
  // loads what `page` renders. content is fetched fresh each call so a revisit
  // picks up other people's posts; the user list is reference data and loads
  // once a session. safe to call on every navigation — overlapping callers
  // share one request. returns error messages, empty when everything loaded
  ensureForPage: (page: Page) => Promise<string[]>;
  // same, but always issues a new request, user list included. for `list` and
  // for refreshes after a write, where the point is to see a change that an
  // already-running request would be too old to contain
  refreshForPage: (page: Page) => Promise<string[]>;
  // drops what the previous session cached, so the next page load refetches as
  // the new user. issues no requests of its own — hence never any errors —
  // because loading follows the page on screen, not the act of logging in
  refreshBoardForUser: (user: SessionUser | null) => Promise<string[]>;
}
