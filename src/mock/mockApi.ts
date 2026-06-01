import {
  apiRoutes,
  initialRegisteredUsers,
  mockDiscussions,
  mockGames,
  mockMail,
} from "./mockData";
import type {
  ApiRoute,
  DiscussionThread,
  GameSummary,
  MailMessage,
  RegisteredUser,
  SessionUser,
  UserProfile,
} from "../types";

let registeredUsers: RegisteredUser[] = [...initialRegisteredUsers];
let discussions: DiscussionThread[] = structuredClone(mockDiscussions);
let mail: MailMessage[] = [...mockMail];
let currentUser: SessionUser | null = null;

function withoutPassword(user: RegisteredUser): UserProfile {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    status: user.status,
    bio: user.bio,
  };
}

function toSessionUser(user: RegisteredUser): SessionUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
  };
}

export async function getApiRoutes(): Promise<ApiRoute[]> {
  return apiRoutes;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  return currentUser;
}

export async function login(username: string, password: string): Promise<SessionUser> {
  const foundUser = registeredUsers.find(
    (user) => user.username === username && user.password === password,
  );

  if (!foundUser) {
    throw new Error("Username or password is incorrect.");
  }

  currentUser = toSessionUser(foundUser);
  return currentUser;
}

export async function register(
  username: string,
  email: string,
  password: string,
): Promise<SessionUser> {
  const cleanUsername = username.trim();
  const cleanEmail = email.trim();

  if (!cleanUsername || !cleanEmail || !password) {
    throw new Error("Username, email, and password are required.");
  }

  if (registeredUsers.some((user) => user.username === cleanUsername)) {
    throw new Error("Username is already registered.");
  }

  const user: RegisteredUser = {
    id: Math.max(...registeredUsers.map((item) => item.id), 0) + 1,
    username: cleanUsername,
    email: cleanEmail,
    password,
    status: "online",
    bio: "Newly registered BBS user.",
  };

  registeredUsers = [...registeredUsers, user];
  currentUser = toSessionUser(user);
  return currentUser;
}

export async function logout(): Promise<void> {
  currentUser = null;
}

export async function listUsers(): Promise<UserProfile[]> {
  return registeredUsers.map(withoutPassword);
}

export async function getUser(id: number): Promise<UserProfile | null> {
  const user = registeredUsers.find((item) => item.id === id);
  return user ? withoutPassword(user) : null;
}

export async function getUserByUsername(username: string): Promise<UserProfile | null> {
  const user = registeredUsers.find((item) => item.username === username.trim());
  return user ? withoutPassword(user) : null;
}

export async function listDiscussions(): Promise<DiscussionThread[]> {
  return structuredClone(discussions);
}

export async function getDiscussion(id: number): Promise<DiscussionThread | null> {
  const discussion = discussions.find((item) => item.id === id);
  return discussion ? structuredClone(discussion) : null;
}

export async function createDiscussion(title: string, body: string): Promise<DiscussionThread> {
  if (!currentUser) {
    throw new Error("You must be logged in to write.");
  }

  const discussion: DiscussionThread = {
    id: Math.max(...discussions.map((item) => item.id), 0) + 1,
    title,
    author: currentUser.username,
    createdAt: new Date().toLocaleString(),
    posts: [
      {
        id: 1,
        author: currentUser.username,
        body,
        createdAt: new Date().toLocaleString(),
      },
    ],
  };

  discussions = [discussion, ...discussions];
  return structuredClone(discussion);
}

export async function createPost(discussionId: number, body: string): Promise<DiscussionThread> {
  if (!currentUser) {
    throw new Error("You must be logged in to write.");
  }

  const discussion = discussions.find((item) => item.id === discussionId);

  if (!discussion) {
    throw new Error("Discussion not found.");
  }

  const updatedDiscussion: DiscussionThread = {
    ...discussion,
    posts: [
      ...discussion.posts,
      {
        id: Math.max(...discussion.posts.map((post) => post.id), 0) + 1,
        author: currentUser.username,
        body,
        createdAt: new Date().toLocaleString(),
      },
    ],
  };

  discussions = discussions.map((item) =>
    item.id === discussionId ? updatedDiscussion : item,
  );

  return structuredClone(updatedDiscussion);
}

export async function listMail(): Promise<MailMessage[]> {
  if (!currentUser) {
    return [];
  }

  return mail
    .filter(
      (message) =>
        message.to === currentUser?.username || message.from === currentUser?.username,
    )
    .toSorted((left, right) => right.id - left.id);
}

export async function getMail(id: number): Promise<MailMessage | null> {
  const message = mail.find((item) => item.id === id);
  return message ? structuredClone(message) : null;
}

export async function sendMail(to: string, body: string): Promise<MailMessage> {
  if (!currentUser) {
    throw new Error("You must be logged in to send mail.");
  }

  const recipient = registeredUsers.find((user) => user.username === to.trim());

  if (!recipient) {
    throw new Error("Recipient username does not exist.");
  }

  const message: MailMessage = {
    id: Math.max(...mail.map((item) => item.id), 0) + 1,
    from: currentUser.username,
    to: recipient.username,
    body,
    createdAt: new Date().toLocaleString(),
    read: false,
  };

  mail = [message, ...mail];
  return message;
}

export async function listGames(): Promise<GameSummary[]> {
  return mockGames;
}
