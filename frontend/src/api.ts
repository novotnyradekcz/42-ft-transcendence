// Every call the app makes to the server, and the only place fetch() is used.
// Callers get back the shapes in types.ts, never a raw server payload — the
// normalize* functions in here do that conversion, and throw if a payload is
// missing something the UI needs.
//
// This is also where the session token lives. login() puts the pair in memory,
// every request attaches it, and an access token that expired mid-session is
// refreshed and the request replayed once, so callers never see that 401.

import type {
  DiscussionThread,
  GameHistoryItem,
  GameSummary,
  LeaderboardItem,
  JwtObject,
  MailMessage,
  SessionUser,
  UserProfile,
} from "./types";
import {CREDENTIALS_KEY, SESSION_USER_KEY} from "./constants";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

// basic_auth stays as an always-null field so it's clear no password is held here
type userCredentials = {
  basic_auth: null,
  jwt_token: JwtObject | null,
}

let currentCredentials: userCredentials | null = null;

// cache of all known users, filled by listUsers()
let knownUsers: UserProfile[] = [];

// token pair as it arrives from the server, nothing checked yet
type JwtPayload = Partial<JwtObject>;

type UserPayload = {
  id?: number | string;
  user_id?: number | string;
  name?: string;
  user_name?: string;
  username?: string;
  email?: string;
  user_email?: string;
  bio?: string;
  avatarUrl?: string;
  avatar_url?: string;
  avatar?: string;
  status?: string;
  friends?: unknown;
  achievements?: unknown;
};

export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, statusText: string, detail?: string) {
    // prefer the server's message over the bare status line
    super(detail || `${status} ${statusText}`);
    this.status = status;
  }
}

// pulls the message field out of a json error body
async function errorDetail(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object") {
      const message = (body as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message;
    }
  } catch {
    // empty or non-json body, fall back to the status line
  }
  return "";
}

// encodes name and password as a basic auth header, only used by login
export function buildBasicAuthHeader(name: string, password: string): string {
  return "Basic " + btoa(`${name}:${password}`);
}

// current credentials, read by SessionContext to persist them after login
export function getCredentials(): userCredentials | null {
  return currentCredentials;
}

// restores credentials and user from sessionStorage, null if there's no session
export function restoreSession(): SessionUser | null {
  try {
    const sessionCreds = sessionStorage.getItem(CREDENTIALS_KEY);
    if (sessionCreds) {
      const credentials = JSON.parse(sessionCreds) as Partial<userCredentials>;
      const userJson = sessionStorage.getItem(SESSION_USER_KEY);
      if (!credentials || !userJson) return null;
      const user = JSON.parse(userJson) as SessionUser;
      // rebuilt field by field so an old stored basic_auth can't come back
      currentCredentials = {
        basic_auth: null,
        jwt_token: credentials.jwt_token ?? null,
      };
      return user;
    } else {
      return null;
    }
  } catch {
    return null;
  }
}

// auth header for the given credentials, null when there are none
// the jwt is base64 wrapped because that's what the server decodes
function authHeaderFor(credentials: userCredentials | null): string | null {
  if (credentials?.jwt_token) {
    return "Bearer " + btoa(`${credentials.jwt_token.access_token}`);
  }
  return null;
}

// auth header for the current session, for callers outside requestJson
// like the websocket handshake, which can't set headers
export function authHeader(): string | null {
  return authHeaderFor(currentCredentials);
}

// the refresh in progress, if any. shared so several requests failing at once
// refresh once between them: the server retires a refresh token as it's spent,
// so a second concurrent attempt would be rejected as reuse and end the session
let refreshing: Promise<boolean> | null = null;

// swap the stored pair for a fresh one, returning whether it worked
async function runRefresh(): Promise<boolean> {
  const refresh_token = currentCredentials?.jwt_token?.refresh_token;
  if (!refresh_token) return false;

  try {
    const response = await fetch(`${apiBaseUrl}/users/refresh_token`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token }),
      credentials: "omit",
    });
    if (!response.ok) return false;

    const jwt_token = normalizeJwt(await response.json());
    if (!jwt_token.access_token) return false;

    currentCredentials = { basic_auth: null, jwt_token };
    // keep the stored copy in step, or a reload would restore the token that
    // was just retired and the session would end on the next request
    sessionStorage.setItem(CREDENTIALS_KEY, JSON.stringify(currentCredentials));
    return true;
  } catch {
    return false;
  }
}

function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = runRefresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

// `retry` is false on the second attempt, so a still-401 reply gives up
// instead of refreshing forever
async function requestJson<T>(
  path: string,
  init?: RequestInit,
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };

  // an explicit header wins, otherwise the session token fills in
  const auth = authHeaderFor(currentCredentials);
  if (auth && !headers["Authorization"]) {
    headers["Authorization"] = auth;
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
    // omitted so the browser doesn't pop its own login dialog on a 401
    credentials: "omit",
  });

  // access tokens last 10 minutes, so a 401 mid-session usually just means
  // this one expired. refresh and replay once; the retry rebuilds the header
  // from the new token. skipped when the caller set its own Authorization,
  // since that request isn't using the session token.
  if (
    response.status === 401 &&
    retry &&
    !(init?.headers as Record<string, string>)?.["Authorization"] &&
    currentCredentials?.jwt_token &&
    (await refreshSession())
  ) {
    return requestJson<T>(path, init, false);
  }

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      response.statusText,
      await errorDetail(response),
    );
  }

  return await response.json() as Promise<T>;
}

// turn raw server payloads into the shapes the app uses
function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function friendsValue(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is number => typeof v === "number");
}

function normalizedStatus(status: unknown): UserProfile["status"] {
  return status === "online" ? "online" : "offline";
}

// fills in a token pair from an unchecked payload. expires_in falling back to
// 0 is load-bearing: login() and exchangeOAuthSession() both read that 0 back
// as "the server didn't send a usable token"
export function normalizeJwt(payload: JwtPayload): JwtObject {
  return {
    access_token: payload.access_token || "",
    expires_in: payload.expires_in || 0,
    refresh_token: payload.refresh_token || "",
    token_type: payload.token_type || "Bearer",
  }
}

export function normalizeUser(payload: unknown): UserProfile {
  const user = payload as UserPayload;
  const id = numberValue(user.id ?? user.user_id);
  const name =
    textValue(user.name) ||
    textValue(user.username) ||
    textValue(user.user_name);
  const email = textValue(user.email) || textValue(user.user_email);

  if (id === null || !name || !email) {
    throw new Error("Invalid user payload.");
  }

  return {
    id,
    name,
    email,
    bio: textValue(user.bio) || "Placeholder bio.",
    avatarUrl:
      textValue(user.avatarUrl) ||
      textValue(user.avatar_url) ||
      textValue(user.avatar),
    status: normalizedStatus(user.status),
    friends: friendsValue(user.friends),
    achievements: friendsValue(user.achievements),
  };
}

export function normalizeUsers(payload: unknown): UserProfile[] {
  if (!Array.isArray(payload)) {
    throw new Error("Invalid user list payload.");
  }
  return payload.map(normalizeUser);
}

// display name for a user id, falls back to user#<id>
export function displayName(id: number, users: UserProfile[]): string {
  return users.find((u) => u.id === id)?.name ?? `user#${id}`;
}

// swaps name and password for a token pair and the user profile
export async function login(
  name: string,
  password: string,
): Promise<SessionUser> {
  const cleanName = name.trim();

  if (!cleanName || !password) {
    throw new Error("Name and password are required.");
  }

  const credentials = buildBasicAuthHeader(cleanName, password);
  const jwt_token = normalizeJwt(
      await requestJson<JwtPayload>("/users/login", {
        method: "GET",
        headers: { Authorization: credentials },
      }),
  );
  if (!jwt_token.access_token || jwt_token.expires_in === 0) {
    throw new Error("Login failed: server returned an invalid token.");
  }
  const user: UserProfile = {...normalizeUser(
      await requestJson<unknown>("/users/me", {
        method: "GET",
        headers: { Authorization: credentials },
      }),
  )};
  // credentials go no further than the two requests above
  currentCredentials = { basic_auth: null, jwt_token };
  return { ...user, status: "online" };
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<SessionUser> {
  const cleanName = name.trim();
  const cleanEmail = email.trim();

  if (!cleanName || !cleanEmail || !password) {
    throw new Error("Name, email, and password are required.");
  }

  // register only answers with a receipt, so log in after to get the profile
  await requestJson<unknown>("/register", {
    method: "POST",
    body: JSON.stringify({ name: cleanName, email: cleanEmail, password }),
  });

  return login(cleanName, password);
}

// clears the in-memory credentials, SessionContext handles sessionStorage
// blacklisting the token on the server is best-effort, the local session goes either way
// returns only whether the server confirmed
export async function logout(): Promise<boolean> {
  // dropped before awaiting so a racing request can't slip out with the old token
  const credentials = currentCredentials;
  currentCredentials = null;
  knownUsers = [];

  const auth = authHeaderFor(credentials);
  try {
    const result = await requestJson<{ message: string }>("/users/logout", {
      method: "POST",
      body: credentials?.jwt_token
        ? JSON.stringify({
            refresh_token: credentials.jwt_token.refresh_token,
          })
        : null,
      // credentials are already dropped, so carry the token explicitly
      ...(auth ? { headers: { Authorization: auth } } : {}),
    });
    return (
      !!result &&
      typeof result === "object" &&
      result.message === "Logged out successfully"
    );
  } catch {
    return false;
  }
}

export async function listUsers(): Promise<UserProfile[]> {
  const users = normalizeUsers(await requestJson<unknown>("/users/show"));
  knownUsers = users;
  return users;
}

// one user by id, written back into knownUsers so later lookups see the change.
// a 404 comes back as null rather than throwing — asking after a user who isn't
// there is an answer, not a failure
export async function getUser(id: number): Promise<UserProfile | null> {
  try {
    const user = normalizeUser(await requestJson<unknown>(`/users/show/${id}`));
    const idx = knownUsers.findIndex((u) => u.id === id);
    if (idx >= 0) {
      knownUsers[idx] = user;
    } else {
      knownUsers = [...knownUsers, user];
    }
    return user;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return null;
    throw error;
  }
}

// name lookup against the cache, falling back to a full listUsers() on a miss.
// so a miss costs a whole-list request — fine at board size, but not what the
// call site looks like it costs
export async function getUserByName(name: string): Promise<UserProfile | null> {
  const cleanName = name.trim();
  const cached = knownUsers.find((u) => u.name === cleanName);
  if (cached) return cached;
  const users = await listUsers();
  return users.find((u) => u.name === cleanName) ?? null;
}

// Only bio and avatar are editable here, so name and email aren't sent.
// That's a UI decision, not a guarantee: any caller with a valid JWT can send
// them anyway, so the server has to reject those fields for this to hold (#49).
// Matters most for `name` — the auth store is keyed by username, so a rename
// is an identity change, not a cosmetic one.
export async function updateCurrentUserProfile(
  userId: number,
  update: { bio: string; avatarUrl?: string },
): Promise<SessionUser> {
  const cleanBio = update.bio.trim();

  const user = normalizeUser(
    await requestJson<unknown>(`/users/update/${userId}`, {
      method: "PUT",
      body: JSON.stringify({
        bio: cleanBio || "Placeholder bio.",
        ...(update.avatarUrl ? { avatarUrl: update.avatarUrl } : {}),
      }),
    }),
  );

  return { ...user, status: "online" };
}

// resolves friend ids to profiles from the given pool
export function listFriends(
  friendIds: number[],
  allUsers: UserProfile[],
): UserProfile[] {
  return friendIds
    .map((id) => allUsers.find((u) => u.id === id))
    .filter((u): u is UserProfile => Boolean(u));
}

export async function addFriend(
  currentUserId: number,
  targetUserId: number,
): Promise<void> {
  await requestJson<unknown>(`/users/${currentUserId}/friends`, {
    method: "POST",
    body: JSON.stringify({ friendId: targetUserId }),
  });
}

export async function removeFriend(
  currentUserId: number,
  targetUserId: number,
): Promise<void> {
  await requestJson<unknown>(
    `/users/${currentUserId}/friends/${targetUserId}`,
    { method: "DELETE" },
  );
}

export async function listDiscussions(): Promise<DiscussionThread[]> {
  return requestJson<DiscussionThread[]>("/discussions/show");
}

export async function getDiscussion(id: number): Promise<DiscussionThread> {
  return requestJson<DiscussionThread>(`/discussions/show/${id}`);
}

export async function createDiscussion(
  title: string,
  body: string,
  authorId: number,
): Promise<DiscussionThread> {
  return requestJson<DiscussionThread>("/discussions/create", {
    method: "POST",
    body: JSON.stringify({ name: title, info: body, author: authorId }),
  });
}

export async function createPost(
  discussionId: number,
  body: string,
  authorId: number,
): Promise<DiscussionThread> {
  return requestJson<DiscussionThread>(`/discussions/${discussionId}/posts`, {
    method: "POST",
    body: JSON.stringify({ body, author: authorId }),
  });
}

export async function listMail(userId: number): Promise<MailMessage[]> {
  const params = new URLSearchParams({ userId: String(userId) });
  return requestJson<MailMessage[]>(`/mail/show?${params.toString()}`);
}

export async function getMail(id: number): Promise<MailMessage> {
  return requestJson<MailMessage>(`/mail/show/${id}`);
}

export async function sendMail(
  senderId: number,
  recipientName: string,
  title: string,
  body: string,
): Promise<MailMessage> {
  const recipient = await getUserByName(recipientName);
  if (!recipient) {
    throw new Error(`User "${recipientName}" not found.`);
  }
  return requestJson<MailMessage>("/mail/create", {
    method: "POST",
    body: JSON.stringify({
      sender: senderId,
      recipient: recipient.id,
      title,
      body,
    }),
  });
}

export async function listGames(): Promise<GameSummary[]> {
  return requestJson<GameSummary[]>("/games/show");
}

export async function createGame(
  name: string,
  body: string,
): Promise<GameSummary> {
  return requestJson<GameSummary>("/games/create", {
    method: "POST",
    body: JSON.stringify({ name, body }),
  });
}

export async function getGameHistory(): Promise<GameHistoryItem[]> {
  return requestJson<GameHistoryItem[]>("/games/history");
}

export async function getLeaderboard(): Promise<LeaderboardItem[]> {
  return requestJson<LeaderboardItem[]>("/games/leaderboard");
}

export async function exchangeOAuthSession(): Promise<SessionUser | null> {
  let payload: JwtPayload;
  try {
    // not requestJson — it sends credentials: "omit" and would drop the cookie
    const response = await fetch(`${apiBaseUrl}/auth/session`, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (!response.ok) return null;
    payload = (await response.json()) as JwtPayload;
  } catch {
    return null;
  }

  const jwt_token = normalizeJwt(payload);
  if (!jwt_token.access_token || jwt_token.expires_in === 0) return null;

  // set before /users/me so requestJson picks the token up
  currentCredentials = { basic_auth: null, jwt_token };

  const user: UserProfile = normalizeUser(
    await requestJson<unknown>("/users/me", { method: "GET" }),
  );
  return { ...user, status: "online" };
}

// Read at import time: the guest catch-all route replaces the URL, so the query
// string is gone before any component mounts.
export const oauthError: string | null = new URLSearchParams(
  window.location.search,
).get("oauth_error");

export interface OAuthProvider {
  id: string;
  label: string;
}

// Asked, not hardcoded, so the menu never offers a provider that isn't set up.
export async function fetchOAuthProviders(): Promise<OAuthProvider[]> {
  try {
    const { providers } = await requestJson<{ providers: OAuthProvider[] }>(
      "/auth/providers",
      { method: "GET" },
    );
    return Array.isArray(providers) ? providers : [];
  } catch {
    return [];
  }
}
