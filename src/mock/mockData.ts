import type {
  ApiRoute,
  DiscussionThread,
  GameSummary,
  MailMessage,
  RegisteredUser,
} from "../types";

export const initialRegisteredUsers: RegisteredUser[] = [
  {
    id: 1,
    username: "admin",
    email: "admin@test.test",
    password: "admin",
    status: "online",
    bio: "Admin profile",
  },
  {
    id: 2,
    username: "test",
    email: "test@test.test",
    password: "test",
    status: "offline",
    bio: "Test",
  },
];

export const mockDiscussions: DiscussionThread[] = [
  {
    id: 1,
    title: "Welcome to the board",
    author: "admin",
    createdAt: "2026-05-26 18:30",
    posts: [
      {
        id: 1,
        author: "admin",
        body: "This is the first public thread. Try `help` or `menu` if you get lost.",
        createdAt: "2026-05-26 18:30",
      },
      {
        id: 2,
        author: "test",
        body: "The terminal idea already feels right for this project.",
        createdAt: "2026-05-27 09:12",
      },
    ],
  },
  {
    id: 2,
    title: "Game ideas",
    author: "admin",
    createdAt: "2026-05-29 14:05",
    posts: [
      {
        id: 1,
        author: "admin",
        body: "Pong first, then maybe a second tiny turn-based game.",
        createdAt: "2026-05-29 14:05",
      },
    ],
  },
];

export const mockMail: MailMessage[] = [
  {
    id: 1,
    from: "admin",
    to: "admin",
    body: "Mail is mocked on the frontend for now. Backend routes can replace this later.",
    createdAt: "2026-05-30 11:45",
    read: false,
  },
];

export const mockGames: GameSummary[] = [];

export const apiRoutes: ApiRoute[] = [
  {
    method: "POST",
    path: "/api/auth/register",
    description: "Create a user account and return the logged-in session user.",
  },
  {
    method: "POST",
    path: "/api/auth/login",
    description: "Log in with username and password.",
  },
  {
    method: "POST",
    path: "/api/auth/logout",
    description: "Clear the current session.",
  },
  {
    method: "GET",
    path: "/api/me",
    description: "Return the current logged-in user or null.",
  },
  {
    method: "GET",
    path: "/api/users",
    description: "List public user profiles.",
  },
  {
    method: "GET",
    path: "/api/users/:id",
    description: "Return one public user profile.",
  },
  {
    method: "GET",
    path: "/api/discussions",
    description: "List discussion threads with post counts.",
  },
  {
    method: "GET",
    path: "/api/discussions/:id",
    description: "Return a discussion thread and its posts.",
  },
  {
    method: "POST",
    path: "/api/discussions",
    description: "Create a new discussion thread.",
  },
  {
    method: "POST",
    path: "/api/discussions/:id/posts",
    description: "Add a post to a discussion thread.",
  },
  {
    method: "GET",
    path: "/api/mail",
    description: "List received and sent mail for the current user.",
  },
  {
    method: "GET",
    path: "/api/mail/:id",
    description: "Return one mail message.",
  },
  {
    method: "POST",
    path: "/api/mail",
    description: "Send a non-live message to another user by username.",
  },
  {
    method: "GET",
    path: "/api/games",
    description: "List games when they are added.",
  },
];
