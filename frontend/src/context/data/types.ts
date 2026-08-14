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
  /**
   * Loads what `page` renders. Content (discussions/games/mail) is fetched
   * fresh each call so a revisit picks up other people's changes; the user
   * list is reference data and only loads once a session. Safe to call on
   * every navigation — duplicate or overlapping calls for the same resource
   * share one in-flight request instead of firing twice.
   * Returns a list of error messages (empty on full success).
   */
  ensureForPage: (page: Page) => Promise<string[]>;
  /**
   * Like ensureForPage but forces a new request, user list included. For
   * `list` and post-write refreshes, where the point is to guarantee a change
   * is picked up rather than to join a request that predates it.
   */
  refreshForPage: (page: Page) => Promise<string[]>;
  /**
   * Drops what was cached for the previous session so the next page load
   * refetches under the new identity. Issues no requests itself — which is why
   * it returns no errors — because loading follows the page being shown, not
   * the act of logging in.
   */
  refreshBoardForUser: (user: SessionUser | null) => Promise<string[]>;
}
