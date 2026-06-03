import type {
  DiscussionThread,
  GameSummary,
  MailMessage,
  SessionUser,
  UserProfile,
} from "./types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
let currentUser: SessionUser | null = null;
let knownUsers: UserProfile[] = [];

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
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

function rememberUser(user: UserProfile) {
  knownUsers = knownUsers.some((item) => item.id === user.id)
    ? knownUsers.map((item) => (item.id === user.id ? user : item))
    : [...knownUsers, user];
}

export function findUserName(id: number): string {
  return knownUsers.find((user) => user.id === id)?.name ?? `user#${id}`;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  return currentUser;
}

export async function login(name: string, password: string): Promise<SessionUser> {
  const cleanName = name.trim();

  if (!cleanName || !password) {
    throw new Error("Name and password are required.");
  }

  currentUser = await requestJson<SessionUser>("/users/login", {
    method: "POST",
    body: JSON.stringify({
      name: cleanName,
      password,
    }),
  });
  rememberUser(currentUser);
  return currentUser;
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

  currentUser = await requestJson<SessionUser>("/users/create", {
    method: "POST",
    body: JSON.stringify({
      name: cleanName,
      email: cleanEmail,
      password,
    }),
  });
  rememberUser(currentUser);
  return currentUser;
}

export async function logout(): Promise<void> {
  currentUser = null;
}

export async function listUsers(): Promise<UserProfile[]> {
  try {
    knownUsers = await requestJson<UserProfile[]>("/users/show");
    return knownUsers;
  } catch {
    knownUsers = [];
    return [];
  }
}

export async function getUser(id: number): Promise<UserProfile | null> {
  try {
    const user = await requestJson<UserProfile>(`/users/show/${id}`);
    rememberUser(user);
    return user;
  } catch {
    return null;
  }
}

export async function getUserByName(name: string): Promise<UserProfile | null> {
  const cleanName = name.trim();
  return knownUsers.find((user) => user.name === cleanName) ?? null;
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
  return requestJson<DiscussionThread>("/discussions/create", {
    method: "POST",
    body: JSON.stringify({ name: title, info: body }),
  });
}

export async function createPost(
  discussionId: number,
  body: string,
): Promise<DiscussionThread> {
  return requestJson<DiscussionThread>(`/discussions/${discussionId}/posts`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export async function listMail(): Promise<MailMessage[]> {
  try {
    return await requestJson<MailMessage[]>("/mail/show");
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
  const recipient = await getUserByName(to);

  return requestJson<MailMessage>("/mail/create", {
    method: "POST",
    body: JSON.stringify({
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
