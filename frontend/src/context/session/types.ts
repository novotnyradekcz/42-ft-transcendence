import type { SessionUser, UserProfile } from "../../types";

export interface SessionContextValue {
  /** The currently authenticated user, or null for guests. */
  sessionUser: SessionUser | null;
  /** All users fetched from the server at login time, held until logout. */
  knownUsers: UserProfile[];
  /** True while the initial sessionStorage restore is in progress. */
  isRestoring: boolean;
  login(name: string, password: string): Promise<SessionUser>;
  register(name: string, email: string, password: string): Promise<SessionUser>;
  logout(): void;
  /**
   * Persist an updated version of the session user (e.g. after profile edit
   * or friend list mutation) to both React state and sessionStorage.
   */
  updateSessionUser(user: SessionUser): void;
  /** Re-fetches /users/show and refreshes knownUsers. */
  refreshUsers(): Promise<void>;
}
