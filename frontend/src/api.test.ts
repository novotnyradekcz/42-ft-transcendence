// tests for api.ts, run with `npm test`

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBasicAuthHeader,
  createGame,
  getGameHistory,
  getLeaderboard,
  listFriends,
  listUsers,
  login,
  logout,
  normalizeUser,
  register,
  restoreSession,
} from "./api";
import { CREDENTIALS_KEY, SESSION_USER_KEY } from "./constants";

const BASE_USER = {
  id: 1,
  name: "alice",
  email: "alice@example.com",
  bio: "test bio",
  avatar_url: "",
  status: "online",
  friends: [2, 3],
};

// what POST /register answers with, a receipt rather than a user
const REGISTER_RECEIPT = {
  success: true,
  message: "Created user: alice",
  email: "alice@example.com",
};

const BASE_JWT_TOKEN = {
  "access_token": "s3cr3ts3cr3ts3cr3ts3cr3t",
  "refresh_token": "s3cr3ts3cr3ts3cr3t",
  "token_type": "Bearer",
  "expires_in": 600
}

// sessionStorage payload a current build writes, token only
const STORED_CREDENTIALS = JSON.stringify({
  basic_auth: null,
  jwt_token: BASE_JWT_TOKEN,
});

function stubFetch(status: number, body: unknown) {
  const mock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText:
      status === 200
        ? "OK"
        : status === 401
          ? "Unauthorized"
          : status === 404
            ? "Not Found"
            : "Internal Server Error",
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

describe("buildBasicAuthHeader", () => {
  it("happy path: produces a valid Basic Auth header value", () => {
    expect(buildBasicAuthHeader("alice", "s3cr3t")).toBe(
      "Basic " + btoa("alice:s3cr3t"),
    );
  });

  it("edge case: password containing a colon is not split", () => {
    const header = buildBasicAuthHeader("bob", "pa:ss:word");
    const decoded = atob(header.slice("Basic ".length));
    expect(decoded).toBe("bob:pa:ss:word");
  });

  it("edge case: spaces and special characters are preserved inside base64", () => {
    const header = buildBasicAuthHeader("user name", "p@$$w0rd!");
    const decoded = atob(header.slice("Basic ".length));
    expect(decoded).toBe("user name:p@$$w0rd!");
  });
});

describe("normalizeUser", () => {
  it("happy path: maps all fields correctly", () => {
    const user = normalizeUser(BASE_USER);
    expect(user.id).toBe(1);
    expect(user.name).toBe("alice");
    expect(user.email).toBe("alice@example.com");
    expect(user.bio).toBe("test bio");
    expect(user.friends).toEqual([2, 3]);
  });

  // The placeholder is a render-time concern, not a value. 
  it("leaves avatarUrl empty when all avatar fields are empty", () => {
    const user = normalizeUser({
      ...BASE_USER,
      avatar_url: "",
      avatarUrl: "",
      avatar: "",
    });
    expect(user.avatarUrl).toBe("");
  });

  it("leaves avatarUrl empty when avatar fields are missing", () => {
    const noAvatar = {
      id: 1,
      name: "alice",
      email: "alice@example.com",
      bio: "test bio",
      status: "online",
      friends: [2, 3],
    };
    const user = normalizeUser(noAvatar);
    expect(user.avatarUrl).toBe("");
  });

  it("happy path: prefers avatarUrl over avatar_url", () => {
    const user = normalizeUser({
      ...BASE_USER,
      avatarUrl: "/images/direct.png",
      avatar_url: "/images/snake.png",
    });
    expect(user.avatarUrl).toBe("/images/direct.png");
  });

  it("happy path: friends defaults to [] when field is missing", () => {
    const noFriends = {
      id: 1,
      name: "alice",
      email: "alice@example.com",
      bio: "test bio",
      avatar_url: "",
      status: "online",
    };
    const user = normalizeUser(noFriends);
    expect(user.friends).toEqual([]);
  });

  it("happy path: filters non-number values out of friends array", () => {
    const user = normalizeUser({ ...BASE_USER, friends: [1, "two", null, 3] });
    expect(user.friends).toEqual([1, 3]);
  });

  it("edge case: throws when id is missing", () => {
    expect(() => normalizeUser({ name: "alice", email: "a@b.com" })).toThrow(
      "Invalid user payload.",
    );
  });

  it("edge case: throws when name is missing", () => {
    expect(() => normalizeUser({ id: 1, email: "a@b.com" })).toThrow(
      "Invalid user payload.",
    );
  });

  it("edge case: uses fallback bio when bio is missing", () => {
    const noBio = {
      id: 1,
      name: "alice",
      email: "alice@example.com",
      avatar_url: "",
      status: "online",
      friends: [],
    };
    const user = normalizeUser(noBio);
    expect(user.bio).toBe("Placeholder bio.");
  });
});

describe("listFriends", () => {
  const allUsers = [
    {
      id: 1,
      name: "alice",
      email: "a@a.com",
      bio: "",
      avatarUrl: "",
      status: "online" as const,
      friends: [],
    },
    {
      id: 2,
      name: "bob",
      email: "b@b.com",
      bio: "",
      avatarUrl: "",
      status: "offline" as const,
      friends: [],
    },
    {
      id: 3,
      name: "carol",
      email: "c@c.com",
      bio: "",
      avatarUrl: "",
      status: "offline" as const,
      friends: [],
    },
  ];

  it("happy path: returns matching UserProfile objects for given IDs", () => {
    const result = listFriends([2, 3], allUsers);
    expect(result.map((u) => u.name)).toEqual(["bob", "carol"]);
  });

  it("happy path: returns empty array for empty friend list", () => {
    expect(listFriends([], allUsers)).toEqual([]);
  });

  it("edge case: silently skips IDs not found in allUsers", () => {
    const result = listFriends([2, 99], allUsers);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("bob");
  });

  it("edge case: returns empty array when allUsers is empty", () => {
    expect(listFriends([1, 2], [])).toEqual([]);
  });
});

describe("login", () => {
  afterEach(() => {
    logout();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("happy path: sends Authorization header (no JSON body) and returns the user", async () => {
    const makeResponse = (body: unknown) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve(body),
    });
    const fetch = vi.fn()
        .mockResolvedValueOnce(makeResponse(BASE_JWT_TOKEN))
        .mockResolvedValueOnce(makeResponse(BASE_USER));
    vi.stubGlobal("fetch", fetch);

    const user = await login("alice", "s3cr3t");

    expect(user.name).toBe("alice");
    expect(user.email).toBe("alice@example.com");
    expect(user.friends).toEqual([2, 3]);

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/users/login");

    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Basic " + btoa("alice:s3cr3t"));
    expect(init.body).toBeUndefined();
  });

  it("happy path: trims leading/trailing whitespace from the name", async () => {
    const makeResponse = (body: unknown) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve(body),
    });
    const fetch = vi.fn()
        .mockResolvedValueOnce(makeResponse(BASE_JWT_TOKEN))
        .mockResolvedValueOnce(makeResponse(BASE_USER));
    vi.stubGlobal("fetch", fetch);

    await login("  alice  ", "s3cr3t");

    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Basic " + btoa("alice:s3cr3t"));
  });

  it("edge case: a user literally named `Bearer` still logs in with Basic", async () => {
    // the header builder used to special-case the name "Bearer" and send
    // the password as a bearer token
    const makeResponse = (body: unknown) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve(body),
    });
    const fetch = vi.fn()
        .mockResolvedValueOnce(makeResponse(BASE_JWT_TOKEN))
        .mockResolvedValueOnce(makeResponse(BASE_USER));
    vi.stubGlobal("fetch", fetch);

    await login("Bearer", "s3cr3t");

    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Basic " + btoa("Bearer:s3cr3t"));
  });

  it("happy path: returned user has status online", async () => {
    const makeResponse = (body: unknown) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve(body),
    });
    const fetch = vi.fn()
        .mockResolvedValueOnce(makeResponse(BASE_JWT_TOKEN))
        .mockResolvedValueOnce(makeResponse({...BASE_USER, status: "offline"}));
    vi.stubGlobal("fetch", fetch);
    const user = await login("alice", "s3cr3t");
    expect(user.status).toBe("online");
  });

  it("edge case: throws when name is empty", async () => {
    await expect(login("", "s3cr3t")).rejects.toThrow(
      "Name and password are required.",
    );
  });

  it("edge case: throws when name is only whitespace", async () => {
    await expect(login("   ", "s3cr3t")).rejects.toThrow(
      "Name and password are required.",
    );
  });

  it("edge case: throws when password is empty", async () => {
    await expect(login("alice", "")).rejects.toThrow(
      "Name and password are required.",
    );
  });

  it("edge case: 401 propagates as an error (no fallback)", async () => {
    stubFetch(401, null);
    await expect(login("alice", "s3cr3t")).rejects.toThrow("401");
  });

  it("edge case: 500 propagates as an error (no fallback)", async () => {
    stubFetch(500, null);
    await expect(login("alice", "s3cr3t")).rejects.toThrow("500");
  });
});

describe("logout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("happy path: clears credentials — subsequent requests carry no Authorization header", async () => {
    const makeResponse = (body: unknown) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve(body),
    });
    const fetch = vi.fn()
        .mockResolvedValueOnce(makeResponse(BASE_JWT_TOKEN))
        .mockResolvedValueOnce(makeResponse(BASE_USER));
    vi.stubGlobal("fetch", fetch);
    await login("alice", "s3cr3t");
    logout();

    const listFetch = stubFetch(200, [BASE_USER]);
    await listUsers();

    const [, init] = listFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });
});

describe("authenticated requests after login", () => {
  afterEach(() => {
    logout();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("attaches the bearer token — never the password — to every subsequent request", async () => {
    const makeResponse = (body: unknown) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve(body),
    });
    const fetch = vi.fn()
        .mockResolvedValueOnce(makeResponse(BASE_JWT_TOKEN))
        .mockResolvedValueOnce(makeResponse(BASE_USER));
    vi.stubGlobal("fetch", fetch);
    await login("alice", "s3cr3t");

    const listFetch = stubFetch(200, [BASE_USER]);
    await listUsers();

    const [, init] = listFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    // the basic header is only for the login handshake, after that it's the token
    expect(headers["Authorization"]).toBe(
      "Bearer " + btoa(BASE_JWT_TOKEN.access_token),
    );
    expect(headers["Authorization"]).not.toContain(btoa("alice:s3cr3t"));
  });

  it("does not attach an Authorization header before any login", async () => {
    const listFetch = stubFetch(200, [BASE_USER]);
    await listUsers();

    const [, init] = listFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });
});

describe("restoreSession", () => {
  afterEach(() => {
    logout();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("happy path: restores user from sessionStorage (simulated page refresh)", async () => {
    sessionStorage.setItem(CREDENTIALS_KEY, STORED_CREDENTIALS);
    sessionStorage.setItem(
      SESSION_USER_KEY,
      JSON.stringify({ ...BASE_USER, avatarUrl: "/img.png" }),
    );

    const user = restoreSession();
    expect(user?.name).toBe("alice");
    expect(user?.friends).toEqual([2, 3]);
  });

  it("happy path: restored credentials are sent on subsequent requests", async () => {
    sessionStorage.setItem(CREDENTIALS_KEY, STORED_CREDENTIALS);
    sessionStorage.setItem(
      SESSION_USER_KEY,
      JSON.stringify({ ...BASE_USER, avatarUrl: "/img.png" }),
    );
    restoreSession(); // arms currentCredentials

    const listFetch = stubFetch(200, [BASE_USER]);
    await listUsers();

    const [, init] = listFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(
      "Bearer " + btoa(BASE_JWT_TOKEN.access_token),
    );
  });

  it("regression: a stored blob from an older build cannot revive a password", async () => {
    // builds before the jwt switch stored basic_auth next to the token
    sessionStorage.setItem(
      CREDENTIALS_KEY,
      JSON.stringify({
        basic_auth: "Basic " + btoa("alice:s3cr3t"),
        jwt_token: BASE_JWT_TOKEN,
      }),
    );
    sessionStorage.setItem(
      SESSION_USER_KEY,
      JSON.stringify({ ...BASE_USER, avatarUrl: "/img.png" }),
    );
    restoreSession();

    const listFetch = stubFetch(200, [BASE_USER]);
    await listUsers();

    const [, init] = listFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).not.toContain(btoa("alice:s3cr3t"));
  });

  it("edge case: returns null when sessionStorage is empty (no prior session)", () => {
    expect(restoreSession()).toBeNull();
  });

  it("edge case: returns null when sessionStorage has malformed JSON", () => {
    sessionStorage.setItem(CREDENTIALS_KEY, "Basic abc");
    sessionStorage.setItem(SESSION_USER_KEY, "{broken json");
    expect(restoreSession()).toBeNull();
  });

  it("edge case: returns null when credentials key is missing", () => {
    sessionStorage.setItem(
      SESSION_USER_KEY,
      JSON.stringify({ ...BASE_USER, avatarUrl: "" }),
    );
    expect(restoreSession()).toBeNull();
  });
});

describe("register", () => {
  // cleared up front too, so a token from an earlier describe can't ride along
  beforeEach(() => {
    logout();
  });

  afterEach(() => {
    logout();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  // register posts, then signs in: receipt, token pair, profile, in that order
  function stubRegisterThenLogin() {
    const makeResponse = (body: unknown) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve(body),
    });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(REGISTER_RECEIPT))
      .mockResolvedValueOnce(makeResponse(BASE_JWT_TOKEN))
      .mockResolvedValueOnce(makeResponse(BASE_USER));
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }

  it("happy path: registers without an Authorization header (new user has no credentials yet)", async () => {
    const fetch = stubRegisterThenLogin();

    const user = await register("alice", "alice@example.com", "s3cr3t");

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/register");

    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();

    // the receipt has no id or name, so the profile comes from the sign-in after
    expect(user.id).toBe(1);
    expect(user.name).toBe("alice");
  });

  it("happy path: registration ends signed in, so later requests carry the token", async () => {
    stubRegisterThenLogin();
    await register("alice", "alice@example.com", "s3cr3t");

    const listFetch = stubFetch(200, [BASE_USER]);
    await listUsers();

    const [, init] = listFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(
      "Bearer " + btoa(BASE_JWT_TOKEN.access_token),
    );
  });

  it("edge case: throws when name is empty", async () => {
    await expect(register("", "alice@example.com", "s3cr3t")).rejects.toThrow(
      "Name, email, and password are required.",
    );
  });

  it("edge case: throws when email is empty", async () => {
    await expect(register("alice", "", "s3cr3t")).rejects.toThrow(
      "Name, email, and password are required.",
    );
  });

  it("edge case: throws when password is empty", async () => {
    await expect(register("alice", "alice@example.com", "")).rejects.toThrow(
      "Name, email, and password are required.",
    );
  });

  it("edge case: 400 propagates as an error (no fallback)", async () => {
    stubFetch(400, null);
    await expect(
      register("alice", "alice@example.com", "s3cr3t"),
    ).rejects.toThrow("400");
  });
});

// queues one reply per call, so a 401 can be followed by the refresh and replay
function stubFetchSequence(replies: { status: number; body: unknown }[]) {
  const mock = vi.fn();
  for (const { status, body } of replies) {
    mock.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "Unauthorized",
      json: () => Promise.resolve(body),
    });
  }
  vi.stubGlobal("fetch", mock);
  return mock;
}

const REFRESHED_JWT_TOKEN = {
  access_token: "fr3sh-access",
  refresh_token: "fr3sh-refresh",
  token_type: "Bearer",
  expires_in: 600,
};

describe("token refresh", () => {
  beforeEach(() => {
    sessionStorage.setItem(CREDENTIALS_KEY, STORED_CREDENTIALS);
    sessionStorage.setItem(
      SESSION_USER_KEY,
      JSON.stringify({ ...BASE_USER, avatarUrl: "" }),
    );
    restoreSession(); // arms currentCredentials with the stored pair
  });

  afterEach(() => {
    logout();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("happy path: an expired access token is refreshed and the request replayed", async () => {
    const mock = stubFetchSequence([
      { status: 401, body: { message: "expired" } }, // original request
      { status: 200, body: REFRESHED_JWT_TOKEN }, // refresh
      { status: 200, body: [BASE_USER] }, // replay
    ]);

    const users = await listUsers();

    expect(mock).toHaveBeenCalledTimes(3);
    expect(String(mock.mock.calls[1][0])).toContain("/users/refresh_token");
    // the replay carries the new token, not the expired one
    const [, replayInit] = mock.mock.calls[2] as [string, RequestInit];
    expect((replayInit.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer " + btoa(REFRESHED_JWT_TOKEN.access_token),
    );
    expect(users).toHaveLength(1);
  });

  it("happy path: the refreshed pair is persisted for the next page load", async () => {
    stubFetchSequence([
      { status: 401, body: {} },
      { status: 200, body: REFRESHED_JWT_TOKEN },
      { status: 200, body: [BASE_USER] },
    ]);

    await listUsers();

    const stored = JSON.parse(sessionStorage.getItem(CREDENTIALS_KEY) ?? "{}");
    // a reload must not restore the token the server just retired
    expect(stored.jwt_token.refresh_token).toBe(
      REFRESHED_JWT_TOKEN.refresh_token,
    );
    expect(stored.basic_auth).toBeNull();
  });

  it("regression: overlapping 401s refresh once, not once each", async () => {
    // the server retires a refresh token as it is spent, so a second
    // concurrent refresh would be refused as reuse and drop the session
    const mock = stubFetchSequence([
      { status: 401, body: {} }, // request A
      { status: 401, body: {} }, // request B
      { status: 200, body: REFRESHED_JWT_TOKEN }, // single refresh
      { status: 200, body: [BASE_USER] }, // replay A
      { status: 200, body: [BASE_USER] }, // replay B
    ]);

    await Promise.all([listUsers(), listUsers()]);

    const refreshCalls = mock.mock.calls.filter((call) =>
      String(call[0]).includes("/users/refresh_token"),
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("edge case: a failed refresh surfaces the 401 instead of looping", async () => {
    const mock = stubFetchSequence([
      { status: 401, body: {} }, // original request
      { status: 401, body: { error: "Refresh token has been revoked" } },
    ]);

    await expect(listUsers()).rejects.toThrow();
    // one attempt, one refusal — no retry storm
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("edge case: login's own 401 does not trigger a refresh", async () => {
    logout(); // no session token to refresh with
    const mock = stubFetchSequence([{ status: 401, body: {} }]);

    await expect(login("alice", "wrong")).rejects.toThrow();
    expect(mock).toHaveBeenCalledTimes(1);
  });
});

describe("createGame", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("happy path: sends POST request to /games/create and returns created game", async () => {
    const mockGame = {
      id: 5,
      author: 2,
      name: "Custom Pong",
      body: "print('pong')",
    };
    const mockFetch = stubFetch(201, mockGame);

    const result = await createGame("Custom Pong", "print('pong')");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/games/create");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Custom Pong",
      body: "print('pong')",
    });
    expect(result).toEqual(mockGame);
  });
});

describe("getGameHistory", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("happy path: fetches game history for authenticated user", async () => {
    const mockHistory = [
      {
        id: 1,
        game_id: 1,
        game_name: "Tic-Tac-Toe",
        player1_id: 1,
        player1_name: "alice",
        player2_id: 2,
        player2_name: "bob",
        winner_id: 1,
        winner_name: "alice",
        played_at: "2026-08-12 09:00",
      },
    ];
    const mockFetch = stubFetch(200, mockHistory);

    const result = await getGameHistory();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/games/history");
    expect(result).toEqual(mockHistory);
  });
});

describe("getLeaderboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("happy path: fetches top 10 players leaderboard", async () => {
    const mockLeaderboard = [
      {
        rank: 1,
        user_id: 1,
        user_name: "alice",
        wins: 5,
        losses: 1,
        draws: 0,
        win_loss_ratio: 5.0,
      },
    ];
    const mockFetch = stubFetch(200, mockLeaderboard);

    const result = await getLeaderboard();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/games/leaderboard");
    expect(result).toEqual(mockLeaderboard);
  });
});
