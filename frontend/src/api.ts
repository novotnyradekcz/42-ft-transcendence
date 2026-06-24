import type {
  DiscussionThread,
  GameSummary,
  MailMessage,
  SessionUser,
  UserProfile,
} from "./types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
export const DEFAULT_AVATAR_URL = "/images/profile.png";

const LOCAL_USERS_KEY = "ft_transcendence.localUsers";
const PROFILE_OVERRIDES_KEY = "ft_transcendence.profileOverrides";
const FRIENDS_KEY = "ft_transcendence.friends";

let currentUser: SessionUser | null = null;
let knownUsers: UserProfile[] = [];

type StoredUser = UserProfile & {
  password: string;
};

type UserPayload = {
  id?: number | string;
  name?: string;
  email?: string;
  password?: string;
  bio?: string;
  avatarUrl?: string;
  status?: string;
};

type ProfileUpdate = Partial<Pick<UserProfile, "name" | "email" | "bio" | "avatarUrl">>;
type ProfileOverrides = Record<string, ProfileUpdate>;
type FriendStore = Record<string, number[]>;

class ApiRequestError extends Error {
  status: number;

  constructor(status: number, statusText: string) {
    super(`${status} ${statusText}`);
    this.status = status;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: "include",
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

function readJson<T>(key: string, fallback: T): T {
  try {
    const storedValue = localStorage.getItem(key);
    return storedValue ? (JSON.parse(storedValue) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
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

  return applyStoredProfile({
    id,
    name,
    email,
    bio: textValue(user.bio) || "No profile info yet.",
    avatarUrl: textValue(user.avatarUrl) || DEFAULT_AVATAR_URL,
    status: normalizedStatus(id, user.status),
  });
}

function normalizeUsers(payload: unknown): UserProfile[] {
  if (!Array.isArray(payload)) {
    throw new Error("Invalid user list payload.");
  }

  return payload.map(normalizeUser);
}

function normalizeStoredUser(payload: unknown): StoredUser | null {
  try {
    const user = payload as UserPayload;
    return {
      ...normalizeUser(user),
      password: textValue(user.password),
    };
  } catch {
    return null;
  }
}

function getProfileOverrides(): ProfileOverrides {
  return readJson<ProfileOverrides>(PROFILE_OVERRIDES_KEY, {});
}

function saveProfileOverride(userId: number, update: ProfileUpdate) {
  const overrides = getProfileOverrides();
  overrides[String(userId)] = {
    ...overrides[String(userId)],
    ...update,
  };
  writeJson(PROFILE_OVERRIDES_KEY, overrides);
}

function applyStoredProfile(user: UserProfile): UserProfile {
  const override = getProfileOverrides()[String(user.id)] ?? {};
  const merged = {
    ...user,
    ...override,
  };

  return {
    ...merged,
    bio: merged.bio || "No profile info yet.",
    avatarUrl: merged.avatarUrl || DEFAULT_AVATAR_URL,
    status: normalizedStatus(user.id, merged.status),
  };
}

function getLocalUsers(): StoredUser[] {
  return readJson<unknown[]>(LOCAL_USERS_KEY, [])
    .map(normalizeStoredUser)
    .filter((user): user is StoredUser => Boolean(user));
}

function saveLocalUsers(users: StoredUser[]) {
  writeJson(LOCAL_USERS_KEY, users);
}

function publicUser(user: StoredUser): UserProfile {
  return applyStoredProfile({
    id: user.id,
    name: user.name,
    email: user.email,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    status: user.status,
  });
}

function localPublicUsers(): UserProfile[] {
  return getLocalUsers().map(publicUser);
}

function mergeUsers(...groups: UserProfile[][]): UserProfile[] {
  const users = new Map<number, UserProfile>();

  for (const group of groups) {
    for (const user of group) {
      users.set(user.id, applyStoredProfile(user));
    }
  }

  return [...users.values()].sort((first, second) => first.id - second.id);
}

function rememberUser(user: UserProfile) {
  const storedUser = applyStoredProfile(user);
  knownUsers = knownUsers.some((item) => item.id === storedUser.id)
    ? knownUsers.map((item) => (item.id === storedUser.id ? storedUser : item))
    : [...knownUsers, storedUser];
}

function nextLocalUserId() {
  const existingIds = [...knownUsers, ...localPublicUsers()].map((user) => user.id);
  return Math.max(0, ...existingIds) + 1;
}

function shouldUseLocalFallback(error: unknown) {
  return !(error instanceof ApiRequestError) || error.status === 404 || error.status >= 500;
}

function updateLocalUser(userId: number, update: ProfileUpdate) {
  const users = getLocalUsers();
  const nextUsers = users.map((user) =>
    user.id === userId
      ? {
          ...user,
          ...update,
          status: "offline" as const,
        }
      : user,
  );
  saveLocalUsers(nextUsers);
}

function getFriendStore(): FriendStore {
  return readJson<FriendStore>(FRIENDS_KEY, {});
}

function saveFriendStore(store: FriendStore) {
  writeJson(FRIENDS_KEY, store);
}

function friendIdsForCurrentUser(): number[] {
  if (!currentUser) {
    return [];
  }

  return getFriendStore()[String(currentUser.id)] ?? [];
}

export function findUserName(id: number): string {
  if (currentUser?.id === id) {
    return currentUser.name;
  }

  return knownUsers.find((user) => user.id === id)?.name ?? `user#${id}`;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const user = normalizeUser(await requestJson<unknown>("/users/me"));
    currentUser = {
      ...user,
      status: "online",
    };
    rememberUser(currentUser);
    return currentUser;
  } catch {
    currentUser = currentUser
      ? {
          ...applyStoredProfile(currentUser),
          status: "online",
        }
      : null;
    return currentUser;
  }
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
        body: JSON.stringify({
          name: cleanName,
          password,
        }),
      }),
    );
    currentUser = {
      ...user,
      status: "online",
    };
    rememberUser(currentUser);
    return currentUser;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      throw new Error("Name or password is incorrect.", { cause: error });
    }

    if (!shouldUseLocalFallback(error)) {
      throw error;
    }

    const user = getLocalUsers().find(
      (item) => item.name === cleanName && item.password === password,
    );

    if (!user) {
      throw new Error("Name or password is incorrect.", { cause: error });
    }

    currentUser = {
      ...applyStoredProfile(user),
      status: "online",
    };
    rememberUser(currentUser);
    return currentUser;
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
      body: JSON.stringify({
        name: cleanName,
        email: cleanEmail,
        password,
      }),
    });
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 417) {
      throw new Error("Name or email is already registered.", { cause: error });
    }

    if (!shouldUseLocalFallback(error)) {
      throw error;
    }

    const users = getLocalUsers();
    if (users.some((user) => user.name === cleanName)) {
      throw new Error("Name is already registered.", { cause: error });
    }

    const newUser: StoredUser = {
      id: nextLocalUserId(),
      name: cleanName,
      email: cleanEmail,
      password,
      bio: "No profile info yet.",
      avatarUrl: DEFAULT_AVATAR_URL,
      status: "offline",
    };
    saveLocalUsers([...users, newUser]);
    currentUser = {
      ...publicUser(newUser),
      status: "online",
    };
    rememberUser(currentUser);
    return currentUser;
  }

  try {
    return await login(cleanName, password);
  } catch {
    const user = await getUserByName(cleanName);
    if (user) {
      currentUser = {
        ...applyStoredProfile(user),
        status: "online",
      };
      rememberUser(currentUser);
      return currentUser;
    }
    throw new Error("Account created. Please log in to continue.");
  }
}

export async function logout(): Promise<void> {
  await fetch(`${apiBaseUrl}/users/logout`, {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
  currentUser = null;
}

export async function listUsers(): Promise<UserProfile[]> {
  try {
    const backendUsers = normalizeUsers(await requestJson<unknown>("/users/show"));
    knownUsers = mergeUsers(backendUsers, localPublicUsers());
    return knownUsers;
  } catch {
    knownUsers = mergeUsers(localPublicUsers());
    return knownUsers;
  }
}

export async function getUser(id: number): Promise<UserProfile | null> {
  try {
    const user = normalizeUser(await requestJson<unknown>(`/users/show/${id}`));
    rememberUser(user);
    return user;
  } catch {
    const user =
      knownUsers.find((item) => item.id === id) ??
      localPublicUsers().find((item) => item.id === id) ??
      null;

    return user ? applyStoredProfile(user) : null;
  }
}

export async function getUserByName(name: string): Promise<UserProfile | null> {
  const cleanName = name.trim();
  const cachedUser = knownUsers.find((user) => user.name === cleanName);

  if (cachedUser) {
    return applyStoredProfile(cachedUser);
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

  const duplicate = (await listUsers()).find(
    (user) => user.id !== currentUser?.id && user.name === cleanName,
  );

  if (duplicate) {
    throw new Error("Another user already has that name.");
  }

  const nextProfile: ProfileUpdate = {
    name: cleanName,
    email: cleanEmail,
    bio: cleanBio || "No profile info yet.",
  };

  if (update.avatarUrl) {
    nextProfile.avatarUrl = update.avatarUrl;
  }

  saveProfileOverride(currentUser.id, nextProfile);
  updateLocalUser(currentUser.id, nextProfile);
  currentUser = {
    ...applyStoredProfile({
      ...currentUser,
      ...nextProfile,
    }),
    status: "online",
  };
  rememberUser(currentUser);
  return currentUser;
}

export async function uploadAvatar(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Avatar must be an image file.");
  }

  const params = new URLSearchParams({
    filename: file.name || "avatar",
  });
  const response = await fetch(`/avatar-upload?${params.toString()}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": file.type,
    },
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

export async function listFriends(): Promise<UserProfile[]> {
  const friendIds = friendIdsForCurrentUser();

  if (friendIds.length === 0) {
    return [];
  }

  const users = await listUsers();
  return friendIds
    .map((id) => users.find((user) => user.id === id) ?? knownUsers.find((user) => user.id === id))
    .filter((user): user is UserProfile => Boolean(user))
    .map(applyStoredProfile);
}

export async function addFriend(userId: number): Promise<UserProfile[]> {
  if (!currentUser) {
    throw new Error("Login first to add friends.");
  }

  if (currentUser.id === userId) {
    throw new Error("You cannot add yourself as a friend.");
  }

  const user = await getUser(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  const store = getFriendStore();
  const currentIds = store[String(currentUser.id)] ?? [];
  store[String(currentUser.id)] = [...new Set([...currentIds, userId])];
  saveFriendStore(store);
  return listFriends();
}

export async function removeFriend(userId: number): Promise<UserProfile[]> {
  if (!currentUser) {
    throw new Error("Login first to remove friends.");
  }

  const store = getFriendStore();
  const currentIds = store[String(currentUser.id)] ?? [];
  store[String(currentUser.id)] = currentIds.filter((id) => id !== userId);
  saveFriendStore(store);
  return listFriends();
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

  const params = new URLSearchParams({
    userId: String(currentUser.id),
  });

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
