"""
HTTPS API client for ft_transcendence — rate-limit stress tester.

Flow:
  1. POST /api/users/login  with Basic auth (username:password)
     → parse JSON body → access_token (raw JWT)
  2. GET  /api/users/show   with Bearer auth (base64-encoded JWT)
     → 20 requests per second, deliberately exceeding the server's
       10 req/s limit so that roughly half receive HTTP 429 responses.

Usage:
  python3 api_client.py

The server uses self-signed TLS on localhost, so certificate verification
is intentionally disabled. Do not use this pattern against production hosts.
"""

import base64
import json
import ssl
import sys
import time
import urllib.error
import urllib.request
from typing import Optional

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URL = "https://localhost"
LOGIN_URL = f"{BASE_URL}/api/users/login"
SHOW_URL = f"{BASE_URL}/api/users/show"

USERNAME = "test"
PASSWORD = "test"
REQUESTS_PER_SECOND = 20   # intentionally 2× the server's 10 req/s limit
REQUEST_COUNT = 20          # total number of requests to fire at /show


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_insecure_ssl_context() -> ssl.SSLContext:
    """Return an SSL context that skips certificate verification.

    Required for localhost with a self-signed certificate.
    Never use this against a remote production host.
    """
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def build_basic_auth_header(username: str, password: str) -> str:
    """Encode *username* and *password* as an HTTP Basic Authorization header value."""
    encoded = base64.b64encode(f"{username}:{password}".encode()).decode()
    return f"Basic {encoded}"


def build_bearer_header(token: str) -> str:
    """Wrap *token* in a Bearer Authorization header, base64-encoding it first.

    The server decodes the base64 layer before validating the JWT, so the raw
    JWT must be base64-encoded here — a raw JWT is not valid base64.
    """
    if not token:
        raise ValueError("token must not be empty")
    encoded = base64.b64encode(token.encode()).decode()
    return f"Bearer {encoded}"


def extract_access_token(body: dict) -> str:
    """Pull *access_token* out of a parsed login response body.

    Raises KeyError  if the key is absent.
    Raises ValueError if the value is empty or None.
    """
    token = body["access_token"]  # intentional KeyError if missing
    if not token:
        raise ValueError(f"access_token in response is empty or None: {token!r}")
    return token


# ---------------------------------------------------------------------------
# API operations
# ---------------------------------------------------------------------------

def login(
    username: str = USERNAME,
    password: str = PASSWORD,
    login_url: str = LOGIN_URL,
    ssl_ctx: Optional[ssl.SSLContext] = None,
) -> str:
    """Authenticate against *login_url* and return the JWT access token.

    The server accepts a Basic Authorization header on this endpoint and
    responds with a JSON body containing *access_token*.

    Raises RuntimeError on any HTTP or network error.
    """
    if ssl_ctx is None:
        ssl_ctx = make_insecure_ssl_context()

    req = urllib.request.Request(login_url, method="GET")
    req.add_header("Authorization", build_basic_auth_header(username, password))
    req.add_header("Accept", "application/json")

    try:
        with urllib.request.urlopen(req, context=ssl_ctx) as response:
            body = json.loads(response.read())
            print(f"body '{body}'")
    except urllib.error.HTTPError as exc:
        raise RuntimeError(
            f"Login failed — HTTP {exc.code}: {exc.reason}"
        ) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Login failed — network error: {exc.reason}") from exc

    return extract_access_token(body)


def perform_requests(
    token: str,
    count: int = REQUEST_COUNT,
    requests_per_second: int = REQUESTS_PER_SECOND,
    show_url: str = SHOW_URL,
    ssl_ctx: Optional[ssl.SSLContext] = None,
) -> None:
    """Send *count* authenticated GET requests to *show_url* at *requests_per_second*.

    Both successful and error responses are printed to stdout so the rate-limit
    behaviour is visible.  Sending 20 req/s against a 10 req/s server limit means
    roughly half the responses will be HTTP 429 Too Many Requests.
    """
    if ssl_ctx is None:
        ssl_ctx = make_insecure_ssl_context()

    interval = 1.0 / requests_per_second
    bearer = build_bearer_header(token)

    for i in range(count):
        req = urllib.request.Request(show_url, method="GET")
        req.add_header("Authorization", bearer)
        req.add_header("Accept", "application/json")

        try:
            with urllib.request.urlopen(req, context=ssl_ctx) as response:
                body = json.loads(response.read())
                print(f"[{i + 1}/{count}] 200 OK: {json.dumps(body, indent=2)}")

        except urllib.error.HTTPError as exc:
            # Read the error body — rate-limit responses often carry detail.
            try:
                error_body = exc.read().decode()
            except Exception:
                error_body = "(no body)"
            print(f"[{i + 1}/{count}] HTTP {exc.code} {exc.reason}: {error_body}")

        except urllib.error.URLError as exc:
            print(f"[{i + 1}/{count}] Network error: {exc.reason}")

        # Rate-limit: sleep between requests but not after the very last one.
        if i < count - 1:
            time.sleep(interval)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print(f"Logging in as '{USERNAME}' at {LOGIN_URL} …")
    try:
        access_token = login()
    except RuntimeError as exc:
        print(f"Fatal: {exc}", file=sys.stderr)
        sys.exit(1)

    print(
        f"Login successful.\n"
        f"Firing {REQUEST_COUNT} requests at {REQUESTS_PER_SECOND} req/s "
        f"(server limit: 10 req/s) → expect ~50 %% HTTP 429 responses.\n"
    )
    perform_requests(access_token)
