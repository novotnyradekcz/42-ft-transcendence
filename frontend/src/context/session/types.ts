// The contract SessionProvider fills in: who is signed in, and the four things
// that can change it. Split out from the provider so the useSession() hook can
// be typed without importing the component.

import type { SessionUser, UserProfile } from "../../types";

export interface SessionContextValue {
  // the signed-in user, null for guests
  sessionUser: SessionUser | null;
  // every user on the board, fetched at login and held until logout. pages read
  // names and avatars out of here rather than fetching per row
  knownUsers: UserProfile[];
  // true while the saved session is being restored from sessionStorage
  isRestoring: boolean;
  // true until the OAuth cookie has been tried. routing waits on this one,
  // because picking a page too early sends the user to the guest front page
  isHydrating: boolean;
  login(name: string, password: string): Promise<SessionUser>;
  register(name: string, email: string, password: string): Promise<SessionUser>;
  logout(): void;
  // writes a changed session user to both state and sessionStorage, so a
  // profile edit or a friend change survives a reload
  updateSessionUser(user: SessionUser): void;
  // refetches /users/show into knownUsers
  refreshUsers(): Promise<void>;
}
