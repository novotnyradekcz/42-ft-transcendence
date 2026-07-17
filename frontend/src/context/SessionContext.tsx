import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { SessionUser, UserProfile } from "../types";
import { CREDENTIALS_KEY, SESSION_USER_KEY } from "../constants";
import {
  getCredentials,
  listUsers,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  restoreSession,
} from "../api";

interface SessionContextValue {
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

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  // Restore synchronously so the first render already has the user — avoids a
  // setState call inside useEffect which can trigger cascading renders.
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(
    () => restoreSession(), // also arms currentCredentials in api.ts
  );
  const [knownUsers, setKnownUsers] = useState<UserProfile[]>([]);
  // isRestoring = true when we have a persisted session but haven't yet
  // re-fetched the full user list from the server.
  const [isRestoring, setIsRestoring] = useState<boolean>(() =>
    Boolean(
      sessionStorage.getItem(CREDENTIALS_KEY) &&
      sessionStorage.getItem(SESSION_USER_KEY),
    ),
  );

  // ─── Rebuild knownUsers after a page refresh (async, non-blocking) ─────────
  useEffect(() => {
    if (!isRestoring) return;
    listUsers()
      .then(setKnownUsers)
      .catch(() => {})
      .finally(() => setIsRestoring(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Internal helpers ──────────────────────────────────────────────────────

  function persistSession(user: SessionUser): void {
    const credentials = getCredentials();
    if (credentials) {
      sessionStorage.setItem(CREDENTIALS_KEY, credentials);
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    }
  }

  function clearSession(): void {
    sessionStorage.removeItem(CREDENTIALS_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  async function login(name: string, password: string): Promise<SessionUser> {
    const user = await apiLogin(name, password);
    persistSession(user);
    setSessionUser(user);
    const users = await listUsers();
    setKnownUsers(users);
    return user;
  }

  async function register(
    name: string,
    email: string,
    password: string,
  ): Promise<SessionUser> {
    const user = await apiRegister(name, email, password);
    persistSession(user);
    setSessionUser(user);
    const users = await listUsers();
    setKnownUsers(users);
    return user;
  }

  function logout(): void {
    apiLogout(); // clears currentCredentials + knownUsers in api module
    clearSession();
    setSessionUser(null);
    setKnownUsers([]);
  }

  function updateSessionUser(user: SessionUser): void {
    setSessionUser(user);
    const credentials = getCredentials();
    if (credentials) {
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    }
  }

  async function refreshUsers(): Promise<void> {
    const users = await listUsers();
    setKnownUsers(users);
  }

  return (
    <SessionContext.Provider
      value={{
        sessionUser,
        knownUsers,
        isRestoring,
        login,
        register,
        logout,
        updateSessionUser,
        refreshUsers,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a <SessionProvider>");
  }
  return ctx;
}
