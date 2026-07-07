/**
 * Tests for the BasicAuth credential management in api.ts.
 *
 * Run with:  npm test
 * Requires:  vitest, jsdom  (npm install --save-dev vitest jsdom)
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildBasicAuthHeader,
  getCurrentUser,
  listUsers,
  login,
  logout,
  register,
  uploadAvatar,
} from "./api";

// ─── helpers ──────────────────────────────────────────────────────────────────

const BASE_USER = {
  id: 1,
  name: "alice",
  email: "alice@example.com",
  bio: "test bio",
  avatar_url: "",
  status: "online",
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
    // Only the first colon separates username from password
    expect(decoded).toBe("bob:pa:ss:word");
  });

  it("edge case: spaces and special characters are preserved inside base64", () => {
    const header = buildBasicAuthHeader("user name", "p@$$w0rd!");
    const decoded = atob(header.slice("Basic ".length));
    expect(decoded).toBe("user name:p@$$w0rd!");
  });
});

// ─── login ────────────────────────────────────────────────────────────────────

describe("login", () => {
  afterEach(async () => {
    await logout();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("happy path: sends Authorization header (no JSON body) and returns the user", async () => {
    const fetch = stubFetch(200, BASE_USER);

    const user = await login("alice", "s3cr3t");

    expect(user.name).toBe("alice");
    expect(user.email).toBe("alice@example.com");

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/users/login");

    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Basic " + btoa("alice:s3cr3t"));

    // No plaintext password in the request body
    expect(init.body).toBeUndefined();
  });

  it("happy path: trims leading/trailing whitespace from the name", async () => {
    const fetch = stubFetch(200, BASE_USER);

    await login("  alice  ", "s3cr3t");

    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    // "alice" (trimmed), not "  alice  "
    expect(headers["Authorization"]).toBe("Basic " + btoa("alice:s3cr3t"));
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

  it("edge case: 401 propagates as an error without falling back to localStorage", async () => {
    stubFetch(401, null);
    // Seed localStorage so a fallback would succeed if incorrectly attempted
    localStorage.setItem(
      "ft_transcendence.localUsers",
      JSON.stringify([{ ...BASE_USER, password: "s3cr3t" }]),
    );

    await expect(login("alice", "s3cr3t")).rejects.toThrow("401");
  });

  it("edge case: 500 falls back to localStorage when the user exists there", async () => {
    stubFetch(500, null);
    localStorage.setItem(
      "ft_transcendence.localUsers",
      JSON.stringify([{ ...BASE_USER, password: "s3cr3t" }]),
    );

    const user = await login("alice", "s3cr3t");
    expect(user.name).toBe("alice");
  });

  it("edge case: 500 + wrong local password throws", async () => {
    stubFetch(500, null);
    localStorage.setItem(
      "ft_transcendence.localUsers",
      JSON.stringify([{ ...BASE_USER, password: "s3cr3t" }]),
    );

    await expect(login("alice", "wrong")).rejects.toThrow(
      "Name or password is incorrect.",
    );
  });
});

// ─── logout ───────────────────────────────────────────────────────────────────

describe("logout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("happy path: clears session so getCurrentUser returns null", async () => {
    stubFetch(200, BASE_USER);
    await login("alice", "s3cr3t");

    await logout();

    expect(await getCurrentUser()).toBeNull();
  });

  it("happy path: clears credentials — subsequent requests carry no Authorization header", async () => {
    stubFetch(200, BASE_USER);
    await login("alice", "s3cr3t");
    await logout();

    const listFetch = stubFetch(200, [BASE_USER]);
    await listUsers();

    const [, init] = listFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });
});

// ─── requestJson credential injection ────────────────────────────────────────

describe("authenticated requests after login", () => {
  afterEach(async () => {
    await logout();
    vi.unstubAllGlobals();
    localStorage.clear();
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

// ─── uploadAvatar ────────────────────────────────────────────────────────────

describe("uploadAvatar", () => {
  afterEach(async () => {
    await logout();
    vi.unstubAllGlobals();
    localStorage.clear();
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
    // login first so credentials are stored
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

// ─── session persistence ──────────────────────────────────────────────────────

describe("session persistence", () => {
  afterEach(async () => {
    await logout();
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("happy path: saves credentials to sessionStorage on login", async () => {
    stubFetch(200, BASE_USER);
    await login("alice", "s3cr3t");

    expect(sessionStorage.getItem("ft_transcendence.credentials")).toBe(
      "Basic " + btoa("alice:s3cr3t"),
    );
    expect(sessionStorage.getItem("ft_transcendence.sessionUser")).toBeTruthy();
  });

  it("happy path: saves credentials to sessionStorage on register", async () => {
    stubFetch(200, BASE_USER);
    await register("alice", "alice@example.com", "s3cr3t");

    expect(sessionStorage.getItem("ft_transcendence.credentials")).toBe(
      "Basic " + btoa("alice:s3cr3t"),
    );
    expect(sessionStorage.getItem("ft_transcendence.sessionUser")).toBeTruthy();
  });

  it("happy path: clears sessionStorage on logout", async () => {
    stubFetch(200, BASE_USER);
    await login("alice", "s3cr3t");
    await logout();

    expect(sessionStorage.getItem("ft_transcendence.credentials")).toBeNull();
    expect(sessionStorage.getItem("ft_transcendence.sessionUser")).toBeNull();
  });

  it("happy path: restores user from sessionStorage (simulated page refresh)", async () => {
    // Seed sessionStorage as a prior login would have done — in-memory is null
    sessionStorage.setItem(
      "ft_transcendence.credentials",
      "Basic " + btoa("alice:s3cr3t"),
    );
    sessionStorage.setItem(
      "ft_transcendence.sessionUser",
      JSON.stringify({
        id: 1,
        name: "alice",
        email: "alice@example.com",
        bio: "test bio",
        avatarUrl: "",
        status: "online",
      }),
    );

    const user = await getCurrentUser();
    expect(user?.name).toBe("alice");
  });

  it("happy path: restored credentials are sent on subsequent requests", async () => {
    sessionStorage.setItem(
      "ft_transcendence.credentials",
      "Basic " + btoa("alice:s3cr3t"),
    );
    sessionStorage.setItem(
      "ft_transcendence.sessionUser",
      JSON.stringify({
        id: 1,
        name: "alice",
        email: "alice@example.com",
        bio: "test bio",
        avatarUrl: "",
        status: "online",
      }),
    );
    await getCurrentUser(); // triggers restore

    const listFetch = stubFetch(200, [BASE_USER]);
    await listUsers();

    const [, init] = listFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Basic " + btoa("alice:s3cr3t"));
  });

  it("edge case: returns null when sessionStorage is empty (no prior session)", async () => {
    // nothing in sessionStorage, currentUser is null
    expect(await getCurrentUser()).toBeNull();
  });

  it("edge case: returns null when sessionStorage has malformed data", async () => {
    sessionStorage.setItem("ft_transcendence.credentials", "Basic abc");
    sessionStorage.setItem("ft_transcendence.sessionUser", "{broken json");

    expect(await getCurrentUser()).toBeNull();
  });
});

// ─── register ────────────────────────────────────────────────────────────────

describe("register", () => {
  afterEach(async () => {
    await logout();
    vi.unstubAllGlobals();
    localStorage.clear();
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
});
