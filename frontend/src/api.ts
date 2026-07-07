import type {
  DiscussionThread,
  GameSummary,
  MailMessage,
  SessionUser,
  UserProfile,
} from "./types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
export const DEFAULT_AVATAR_URL = "/images/profile.png";

let currentUser: SessionUser | null = null;
let knownUsers: UserProfile[] = [];

type UserPayload = {
  id?: number | string;
  name?: string;
  email?: string;
  bio?: string;
  avatarUrl?: string;
  status?: string;
};

class ApiRequestError extends Error {
  status: number;

  constructor(status: number, statusText: string) {
    super(`${status} ${statusText}`);
    this.status = status;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiRequestError(response.status, response.statusText);
  }

  return response.json() as Promise<T>;
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizedStatus(userId: number, status: unknown): UserProfile["status"] {
  if (currentUser?.id === userId) {
    return "online";
  }

  return status === "online" ? "online" : "offline";
}

function normalizeUser(payload: unknown): UserProfile {
  const user = payload as UserPayload;
  const id = numberValue(user.id);
  const name = textValue(user.name);
  const email = textValue(user.email);

  if (id === null || !name || !email) {
    throw new Error("Invalid user payload.");
  }

  return {
    id,
    name,
    email,
    bio: textValue(user.bio) || "No profile info yet.",
    avatarUrl: textValue(user.avatarUrl) || DEFAULT_AVATAR_URL,
    status: normalizedStatus(id, user.status),
  };
}

function normalizeUsers(payload: unknown): UserProfile[] {
  if (!Array.isArray(payload)) {
    throw new Error("Invalid user list payload.");
  }

  return payload.map(normalizeUser);
}

function rememberUser(user: UserProfile) {
  knownUsers = knownUsers.some((item) => item.id === user.id)
    ? knownUsers.map((item) => (item.id === user.id ? user : item))
    : [...knownUsers, user];
}

export function findUserName(id: number): string {
  if (currentUser?.id === id) {
    return currentUser.name;
  }

  return knownUsers.find((user) => user.id === id)?.name ?? `user#${id}`;
}

// There is no session yet (the real auth layer is still in progress), so the
// logged-in user only lives in memory: a page refresh requires a new login.
export async function getCurrentUser(): Promise<SessionUser | null> {
  return currentUser;
}

export async function login(name: string, password: string): Promise<SessionUser> {
  const cleanName = name.trim();

  if (!cleanName || !password) {
    throw new Error("Name and password are required.");
  }

  try {
    const user = normalizeUser(
      await requestJson<unknown>("/users/login", {
        method: "POST",
        body: JSON.stringify({ name: cleanName, password }),
      }),
    );
    currentUser = { ...user, status: "online" };
    rememberUser(currentUser);
    return currentUser;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      throw new Error("Name or password is incorrect.", { cause: error });
    }

    throw error;
  }
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

  try {
    await requestJson<unknown>("/users/create", {
      method: "POST",
      body: JSON.stringify({ name: cleanName, email: cleanEmail, password }),
    });
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 417) {
      throw new Error("Name or email is already registered.", { cause: error });
    }

    throw error;
  }

  // Backend create only returns a confirmation; log in to fetch the user info.
  return login(cleanName, password);
}

export async function logout(): Promise<void> {
  currentUser = null;
}

export async function listUsers(): Promise<UserProfile[]> {
  try {
    knownUsers = normalizeUsers(await requestJson<unknown>("/users/show"));
    return knownUsers;
  } catch {
    return knownUsers;
  }
}

export async function getUser(id: number): Promise<UserProfile | null> {
  try {
    const user = normalizeUser(await requestJson<unknown>(`/users/show/${id}`));
    rememberUser(user);
    return user;
  } catch {
    return knownUsers.find((item) => item.id === id) ?? null;
  }
}

export async function getUserByName(name: string): Promise<UserProfile | null> {
  const cleanName = name.trim();
  const cachedUser = knownUsers.find((user) => user.name === cleanName);

  if (cachedUser) {
    return cachedUser;
  }

  const users = await listUsers();
  return users.find((user) => user.name === cleanName) ?? null;
}

export async function updateCurrentUserProfile(update: {
  name: string;
  email: string;
  bio: string;
  avatarUrl?: string;
}): Promise<SessionUser> {
  if (!currentUser) {
    throw new Error("Login first to update your profile.");
  }

  const cleanName = update.name.trim();
  const cleanEmail = update.email.trim();
  const cleanBio = update.bio.trim();

  if (!cleanName || !cleanEmail) {
    throw new Error("Name and email are required.");
  }

  // No session: the backend needs to be told which user to update.
  const body: Record<string, string | number> = {
    id: currentUser.id,
    name: cleanName,
    email: cleanEmail,
    bio: cleanBio,
  };

  // An empty avatarUrl tells the backend to keep the current avatar.
  if (update.avatarUrl) {
    body.avatarUrl = update.avatarUrl;
  }

  const user = normalizeUser(
    await requestJson<unknown>("/users/update", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
  currentUser = { ...user, status: "online" };
  rememberUser(currentUser);
  return currentUser;
}

export async function uploadAvatar(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Avatar must be an image file.");
  }

  // "Nothing fancy": encode the image as a data URL and store it in the
  // user's avatar_url column via updateCurrentUserProfile (no file storage).
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.readAsDataURL(file);
  });
}

export async function listFriends(): Promise<UserProfile[]> {
  if (!currentUser) {
    return [];
  }

  try {
    const friends = normalizeUsers(
      await requestJson<unknown>(`/users/friends?userId=${currentUser.id}`),
    );
    friends.forEach(rememberUser);
    return friends;
  } catch {
    return [];
  }
}

export async function addFriend(userId: number): Promise<UserProfile[]> {
  if (!currentUser) {
    throw new Error("Login first to add friends.");
  }

  if (currentUser.id === userId) {
    throw new Error("You cannot add yourself as a friend.");
  }

  const friends = normalizeUsers(
    await requestJson<unknown>(`/users/friends/${userId}?userId=${currentUser.id}`, {
      method: "POST",
    }),
  );
  friends.forEach(rememberUser);
  return friends;
}

export async function removeFriend(userId: number): Promise<UserProfile[]> {
  if (!currentUser) {
    throw new Error("Login first to remove friends.");
  }

  const friends = normalizeUsers(
    await requestJson<unknown>(`/users/friends/${userId}?userId=${currentUser.id}`, {
      method: "DELETE",
    }),
  );
  friends.forEach(rememberUser);
  return friends;
}

export async function listDiscussions(): Promise<DiscussionThread[]> {
  try {
    return await requestJson<DiscussionThread[]>("/discussions/show");
  } catch {
    return [];
  }
}

export async function getDiscussion(id: number): Promise<DiscussionThread | null> {
  try {
    return await requestJson<DiscussionThread>(`/discussions/show/${id}`);
  } catch {
    return null;
  }
}

export async function createDiscussion(
  title: string,
  body: string,
): Promise<DiscussionThread> {
  if (!currentUser) {
    throw new Error("Login first to write discussions.");
  }

  return requestJson<DiscussionThread>("/discussions/create", {
    method: "POST",
    body: JSON.stringify({ name: title, info: body, author: currentUser.id }),
  });
}

export async function createPost(
  discussionId: number,
  body: string,
): Promise<DiscussionThread> {
  if (!currentUser) {
    throw new Error("Login first to write replies.");
  }

  return requestJson<DiscussionThread>(`/discussions/${discussionId}/posts`, {
    method: "POST",
    body: JSON.stringify({ body, author: currentUser.id }),
  });
}

export async function listMail(): Promise<MailMessage[]> {
  if (!currentUser) {
    return [];
  }

  const params = new URLSearchParams({ userId: String(currentUser.id) });

  try {
    return await requestJson<MailMessage[]>(`/mail/show?${params.toString()}`);
  } catch {
    return [];
  }
}

export async function getMail(id: number): Promise<MailMessage | null> {
  try {
    return await requestJson<MailMessage>(`/mail/show/${id}`);
  } catch {
    return null;
  }
}

export async function sendMail(
  to: string,
  title: string,
  body: string,
): Promise<MailMessage> {
  if (!currentUser) {
    throw new Error("Login first to send mail.");
  }

  const recipient = await getUserByName(to);

  return requestJson<MailMessage>("/mail/create", {
    method: "POST",
    body: JSON.stringify({
      sender: currentUser.id,
      recipient: recipient?.id,
      to,
      title,
      body,
    }),
  });
}

export async function listGames(): Promise<GameSummary[]> {
  try {
    return await requestJson<GameSummary[]>("/games/show");
  } catch {
    return [];
  }
}
