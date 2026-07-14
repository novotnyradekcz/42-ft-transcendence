import type {
  DiscussionThread,
  GameSummary,
  MailMessage,
  SessionUser,
  UserProfile,
} from "../../types";

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
   * Fetches public data (discussions, games) and, when a user is provided,
   * also fetches mail and refreshes the user list.
   * Returns a list of error messages (empty on full success).
   */
  refreshBoard: () => Promise<string[]>;
  /**
   * Same as refreshBoard but uses the provided user for the mail fetch.
   * Call this right after login before React state has propagated.
   */
  refreshBoardForUser: (user: SessionUser | null) => Promise<string[]>;
}
