import type {
  DiscussionThread,
  GameSummary, JwtObject,
  MailMessage,
  SessionUser,
  UserProfile,
} from "./types";
import {CREDENTIALS_KEY, PH_USER_IMAGE, SESSION_USER_KEY} from "./constants";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

type userCredentials = {
  basic_auth: string | null,
  jwt_token: JwtObject | null,
}

let currentCredentials: userCredentials | null = null;

/**
 * In-memory cache of all known users, populated by listUsers().
 * Used by findUserName() and getUserByName() for fast lookups.
 */
let knownUsers: UserProfile[] = [];

type JwtPayload = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  token_type?: string;
}

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
};

export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, statusText: string) {
    super(`${status} ${statusText}`);
    this.status = status;
  }
}

// ─── Credential helpers ───────────────────────────────────────────────────────

/**
 * Encodes a username and password as an HTTP Basic Auth header value.
 */
export function buildBasicAuthHeader(name: string, password: string): string {
  return "Basic " + btoa(`${name}:${password}`);
}

/** Called by SessionContext after login / session restore to arm requests. */

export function setCredentialsBasic(creds: string | null): void {
  if (currentCredentials) {
    currentCredentials.basic_auth = creds;
  } else {
    currentCredentials = { basic_auth: creds, jwt_token: null };
  }
}

export function setCredentialsJwt(creds: JwtObject | null): void {
  if (currentCredentials) {
    currentCredentials.jwt_token = creds;
  } else {
    currentCredentials = { basic_auth: null, jwt_token: creds };
  }
}

/** Called by SessionContext to persist credentials after login. */
export function getCredentials(): userCredentials | null {
  return currentCredentials;
}

// ─── Session restore (reads sessionStorage, arms credentials) ─────────────────

/**
 * Reads credentials and user data from sessionStorage.
 * Sets currentCredentials so subsequent requests are authenticated.
 * Returns the stored SessionUser or null if no valid session exists.
 */
export function restoreSession(): SessionUser | null {
  try {
    const sessionCreds = sessionStorage.getItem(CREDENTIALS_KEY);
    if (sessionCreds) {
      const credentials = JSON.parse(sessionCreds);
      const userJson = sessionStorage.getItem(SESSION_USER_KEY);
      if (!credentials || !userJson) return null;
      const user = JSON.parse(userJson) as SessionUser;
      currentCredentials = credentials;
      return user;
    } else {
      return null;
    }
  } catch {
    return null;
  }
}

// ─── Core request helper ──────────────────────────────────────────────────────

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };

  if (currentCredentials?.basic_auth && !headers["Authorization"]) {
    headers["Authorization"] = currentCredentials.basic_auth;
  }

  console.log("apiBaseUrl: ", apiBaseUrl);
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });

  if (!response.ok) {
    throw new ApiRequestError(response.status, response.statusText);
  }

  return await response.json() as Promise<T>;
}

// ─── Normalisation helpers ────────────────────────────────────────────────────

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

export function normalizeJwt(payload: JwtPayload): JwtObject {
  return {
    access_token: payload.access_token || "",
    expires_in: payload.expires_in || 0,
    refresh_token: payload.refresh_token || "",
    token_type: payload.access_token || "Bearer",
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
  console.log("user: ", user);
  if (id === null || !name || !email) {
    throw new Error("Invalid user payload.");
  }

  return {
    id,
    name,
    email,
    bio: textValue(user.bio) || "No profile info yet.",
    avatarUrl:
      textValue(user.avatarUrl) ||
      textValue(user.avatar_url) ||
      textValue(user.avatar) ||
      PH_USER_IMAGE,
    status: normalizedStatus(user.status),
    friends: friendsValue(user.friends),
  };
}

export function normalizeUsers(payload: unknown): UserProfile[] {
  if (!Array.isArray(payload)) {
    throw new Error("Invalid user list payload.");
  }
  return payload.map(normalizeUser);
}

// ─── User name lookup (uses in-memory cache) ──────────────────────────────────

export function findUserName(id: number): string {
  return knownUsers.find((u) => u.id === id)?.name ?? `user#${id}`;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

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
  if (jwt_token.expires_in === 0) {
    throw new Error("Login failed: server returned an invalid token.");
  }
  const user = normalizeUser(
      await requestJson<unknown>("/users/me", {
        method: "GET",
        headers: { Authorization: credentials },
      }),
  );
  currentCredentials = {
    basic_auth: credentials,
    jwt_token,
  };
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

  const user = normalizeUser(
    await requestJson<unknown>("/users/create", {
      method: "POST",
      body: JSON.stringify({ name: cleanName, email: cleanEmail, password }),
    }),
  );

  currentCredentials = { basic_auth: buildBasicAuthHeader(cleanName, password), jwt_token: null };
  return { ...user, status: "online" };
}

/** Clears the in-memory credentials. SessionContext handles sessionStorage. */
export function logout(): void {
  currentCredentials = null;
  knownUsers = [];
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function listUsers(): Promise<UserProfile[]> {
  const users = normalizeUsers(await requestJson<unknown>("/users/show"));
  knownUsers = users;
  return users;
}

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

export async function getUserByName(name: string): Promise<UserProfile | null> {
  const cleanName = name.trim();
  const cached = knownUsers.find((u) => u.name === cleanName);
  if (cached) return cached;
  const users = await listUsers();
  return users.find((u) => u.name === cleanName) ?? null;
}

export async function updateCurrentUserProfile(
  userId: number,
  update: { name: string; email: string; bio: string; avatarUrl?: string },
): Promise<SessionUser> {
  const cleanName = update.name.trim();
  const cleanEmail = update.email.trim();
  const cleanBio = update.bio.trim();

  if (!cleanName || !cleanEmail) {
    throw new Error("Name and email are required.");
  }

  const user = normalizeUser(
    await requestJson<unknown>(`/users/update/${userId}`, {
      method: "PUT",
      body: JSON.stringify({
        name: cleanName,
        email: cleanEmail,
        bio: cleanBio || "No profile info yet.",
        ...(update.avatarUrl ? { avatarUrl: update.avatarUrl } : {}),
      }),
    }),
  );

  return { ...user, status: "online" };
}

export async function uploadAvatar(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Avatar must be an image file.");
  }

  const params = new URLSearchParams({ filename: file.name || "avatar" });
  const uploadHeaders: Record<string, string> = {
    "Content-Type": file.type,
  };

  if (currentCredentials) {
    if (currentCredentials.basic_auth) {
      uploadHeaders["Authorization"] = currentCredentials.basic_auth;
    }
  }

  const response = await fetch(`/avatar-upload?${params.toString()}`, {
    method: "POST",
    headers: uploadHeaders,
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Avatar upload failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as { avatarUrl?: string };
  if (!payload.avatarUrl) {
    throw new Error("Avatar upload did not return an image path.");
  }

  return payload.avatarUrl;
}

// ─── Friends ─────────────────────────────────────────────────────────────────

/**
 * Pure helper — resolves a list of friend IDs to full UserProfile objects
 * using the provided user pool. No network request.
 */
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

// ─── Discussions ──────────────────────────────────────────────────────────────

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

// ─── Mail ─────────────────────────────────────────────────────────────────────

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

// ─── Games ───────────────────────────────────────────────────────────────────

export async function listGames(): Promise<GameSummary[]> {
  return requestJson<GameSummary[]>("/games/show");
}
