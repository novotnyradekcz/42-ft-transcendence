/**
 * Tests for api.ts — Basic Auth management, session restore,
 * user normalisation, and pure helpers.
 *
 * Run with:  npm test
 * Requires:  vitest, jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildBasicAuthHeader,
  listFriends,
  listUsers,
  login,
  logout,
  normalizeUser,
  register,
  restoreSession,
  setCredentials,
  uploadAvatar,
} from "./api";
import { CREDENTIALS_KEY, PH_USER_IMAGE, SESSION_USER_KEY } from "./constants";

// ─── helpers ──────────────────────────────────────────────────────────────────

const BASE_USER = {
  id: 1,
  name: "alice",
  email: "alice@example.com",
  bio: "test bio",
  avatar_url: "",
  status: "online",
  friends: [2, 3],
};

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

// ─── buildBasicAuthHeader ─────────────────────────────────────────────────────

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

// ─── normalizeUser ────────────────────────────────────────────────────────────

describe("normalizeUser", () => {
  it("happy path: maps all fields correctly", () => {
    const user = normalizeUser(BASE_USER);
    expect(user.id).toBe(1);
    expect(user.name).toBe("alice");
    expect(user.email).toBe("alice@example.com");
    expect(user.bio).toBe("test bio");
    expect(user.friends).toEqual([2, 3]);
  });

  it("happy path: uses PH_USER_IMAGE when avatar fields are all empty", () => {
    const user = normalizeUser({
      ...BASE_USER,
      avatar_url: "",
      avatarUrl: "",
      avatar: "",
    });
    expect(user.avatarUrl).toBe(PH_USER_IMAGE);
  });

  it("happy path: uses PH_USER_IMAGE when avatar fields are missing", () => {
    const noAvatar = {
      id: 1,
      name: "alice",
      email: "alice@example.com",
      bio: "test bio",
      status: "online",
      friends: [2, 3],
    };
    const user = normalizeUser(noAvatar);
    expect(user.avatarUrl).toBe(PH_USER_IMAGE);
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
    expect(user.bio).toBe("No profile info yet.");
  });
});

// ─── listFriends (pure helper) ────────────────────────────────────────────────

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

// ─── login ────────────────────────────────────────────────────────────────────

describe("login", () => {
  afterEach(() => {
    logout();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("happy path: sends Authorization header (no JSON body) and returns the user", async () => {
    const fetch = stubFetch(200, BASE_USER);

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
    const fetch = stubFetch(200, BASE_USER);

    await login("  alice  ", "s3cr3t");

    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Basic " + btoa("alice:s3cr3t"));
  });

  it("happy path: returned user has status online", async () => {
    stubFetch(200, { ...BASE_USER, status: "offline" });
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

// ─── logout ───────────────────────────────────────────────────────────────────

describe("logout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("happy path: clears credentials — subsequent requests carry no Authorization header", async () => {
    stubFetch(200, BASE_USER);
    await login("alice", "s3cr3t");
    logout();

    const listFetch = stubFetch(200, [BASE_USER]);
    await listUsers();

    const [, init] = listFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });
});

// ─── authenticated requests after login ──────────────────────────────────────

describe("authenticated requests after login", () => {
  afterEach(() => {
    logout();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("attaches stored credentials to every subsequent request", async () => {
    stubFetch(200, BASE_USER);
    await login("alice", "s3cr3t");

    const listFetch = stubFetch(200, [BASE_USER]);
    await listUsers();

    const [, init] = listFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Basic " + btoa("alice:s3cr3t"));
  });

  it("does not attach an Authorization header before any login", async () => {
    const listFetch = stubFetch(200, [BASE_USER]);
    await listUsers();

    const [, init] = listFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });
});

// ─── restoreSession ───────────────────────────────────────────────────────────

describe("restoreSession", () => {
  afterEach(() => {
    logout();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("happy path: restores user from sessionStorage (simulated page refresh)", async () => {
    sessionStorage.setItem(CREDENTIALS_KEY, "Basic " + btoa("alice:s3cr3t"));
    sessionStorage.setItem(
      SESSION_USER_KEY,
      JSON.stringify({ ...BASE_USER, avatarUrl: "/img.png" }),
    );

    const user = restoreSession();
    expect(user?.name).toBe("alice");
    expect(user?.friends).toEqual([2, 3]);
  });

  it("happy path: restored credentials are sent on subsequent requests", async () => {
    sessionStorage.setItem(CREDENTIALS_KEY, "Basic " + btoa("alice:s3cr3t"));
    sessionStorage.setItem(
      SESSION_USER_KEY,
      JSON.stringify({ ...BASE_USER, avatarUrl: "/img.png" }),
    );
    restoreSession(); // arms currentCredentials

    const listFetch = stubFetch(200, [BASE_USER]);
    await listUsers();

    const [, init] = listFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Basic " + btoa("alice:s3cr3t"));
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

// ─── setCredentials ───────────────────────────────────────────────────────────

describe("setCredentials", () => {
  afterEach(() => {
    logout();
    vi.unstubAllGlobals();
  });

  it("happy path: credentials set externally are used on the next request", async () => {
    setCredentials("Basic " + btoa("bob:pass"));

    const listFetch = stubFetch(200, [BASE_USER]);
    await listUsers();

    const [, init] = listFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Basic " + btoa("bob:pass"));
  });

  it("edge case: passing null removes credentials from subsequent requests", async () => {
    setCredentials("Basic " + btoa("bob:pass"));
    setCredentials(null);

    const listFetch = stubFetch(200, [BASE_USER]);
    await listUsers();

    const [, init] = listFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });
});

// ─── uploadAvatar ─────────────────────────────────────────────────────────────

describe("uploadAvatar", () => {
  afterEach(() => {
    logout();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  function makeImageFile(name = "photo.png", type = "image/png") {
    return new File(["data"], name, { type });
  }

  function stubUploadFetch(status: number, body: unknown) {
    const mock = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 201 ? "Created" : "Error",
      json: () => Promise.resolve(body),
    });
    vi.stubGlobal("fetch", mock);
    return mock;
  }

  it("happy path: sends Authorization header when authenticated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve(BASE_USER),
      }),
    );
    await login("alice", "s3cr3t");

    const uploadFetch = stubUploadFetch(201, { avatarUrl: "/images/test.png" });
    await uploadAvatar(makeImageFile());

    const [, init] = uploadFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Basic " + btoa("alice:s3cr3t"));
  });

  it("happy path: does not send Authorization header when not logged in", async () => {
    const uploadFetch = stubUploadFetch(201, { avatarUrl: "/images/test.png" });
    await uploadAvatar(makeImageFile());

    const [, init] = uploadFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("happy path: preserves Content-Type header", async () => {
    const uploadFetch = stubUploadFetch(201, {
      avatarUrl: "/images/test.webp",
    });
    await uploadAvatar(makeImageFile("photo.webp", "image/webp"));

    const [, init] = uploadFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("image/webp");
  });

  it("edge case: throws when file is not an image", async () => {
    await expect(
      uploadAvatar(new File(["x"], "doc.pdf", { type: "application/pdf" })),
    ).rejects.toThrow("Avatar must be an image file.");
  });

  it("edge case: throws when server returns non-ok status", async () => {
    stubUploadFetch(500, {});
    await expect(uploadAvatar(makeImageFile())).rejects.toThrow(
      "Avatar upload failed with status 500.",
    );
  });

  it("edge case: throws when server does not return avatarUrl", async () => {
    stubUploadFetch(201, {});
    await expect(uploadAvatar(makeImageFile())).rejects.toThrow(
      "Avatar upload did not return an image path.",
    );
  });
});

// ─── register ─────────────────────────────────────────────────────────────────

describe("register", () => {
  afterEach(() => {
    logout();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("happy path: registers without an Authorization header (new user has no credentials yet)", async () => {
    const fetch = stubFetch(200, BASE_USER);

    await register("alice", "alice@example.com", "s3cr3t");

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/users/create");

    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("happy path: stores credentials after registration so subsequent requests are authenticated", async () => {
    stubFetch(200, BASE_USER);
    await register("alice", "alice@example.com", "s3cr3t");

    const listFetch = stubFetch(200, [BASE_USER]);
    await listUsers();

    const [, init] = listFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Basic " + btoa("alice:s3cr3t"));
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
