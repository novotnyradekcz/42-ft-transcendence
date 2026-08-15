import { useEffect, useState, type ReactNode } from "react";
import type {SessionUser, UserProfile} from "../../types";
import { CREDENTIALS_KEY, SESSION_USER_KEY } from "../../constants";
import {
  getCredentials,
  listUsers,
  login as apiLogin,
  loginWith42,
  logout as apiLogout,
  register as apiRegister,
  restoreSession,
} from "../../api";
import { SessionContext } from "./useSession";

export function SessionProvider({ children }: { children: ReactNode }) {
  // restored synchronously so the first render already has the user
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(
    () => restoreSession(), // also arms currentCredentials in api.ts
  );
  const [knownUsers, setKnownUsers] = useState<UserProfile[]>([]);
  // true when a saved session exists but the user list isn't fetched yet
  const [isRestoring, setIsRestoring] = useState<boolean>(() =>
    Boolean(
      sessionStorage.getItem(CREDENTIALS_KEY) &&
      sessionStorage.getItem(SESSION_USER_KEY),
    ),
  );

  // True until the OAuth cookie exchange has been attempted. Distinct from
  // isRestoring, which covers the synchronous sessionStorage path: this one
  // resolves over the network, so a route table rendered before it settles
  // would send an authenticated user to the guest pages. Only armed when
  // storage was empty — a restored session needs no exchange.
  const [isHydrating, setIsHydrating] = useState<boolean>(
    () => sessionUser === null,
  );

  // rebuilds knownUsers after a page refresh, without blocking
  useEffect(() => {
    if (!isRestoring) return;
    listUsers()
      .then(setKnownUsers)
      .catch(() => {})
      .finally(() => setIsRestoring(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A 42 login lands back here with empty sessionStorage: the only credential
  // is the one-shot cookie the server set during the callback. Spend it before
  // treating the visitor as anonymous. Separate from the effect above, which
  // only runs when sessionStorage already held a session — the exact opposite
  // condition.
  useEffect(() => {
    if (!isHydrating) return;
    let cancelled = false;
    loginWith42()
      .then(async (user) => {
        if (cancelled || !user) return;
        persistSession(user);
        setSessionUser(user);
        setKnownUsers(await listUsers());
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsHydrating(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistSession(user: SessionUser): void {
    const credentials = getCredentials();
    if (credentials) {
      sessionStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    }
  }

  function clearSession(): void {
    sessionStorage.removeItem(CREDENTIALS_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
  }

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

  async function logout(): Promise<void> {
    // local session goes first, an unreachable server can't keep anyone signed in
    clearSession();
    setSessionUser(null);
    setKnownUsers([]);
    await apiLogout();
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
        isHydrating,
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
