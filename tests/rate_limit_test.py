"""
Rate-limit integration test.

Fires 100 requests per second at https://127.0.0.1/api/users/show after
authenticating via https://127.0.0.1/api/users/login.  The server enforces a
10 req/s limit, so the majority of responses are expected to be HTTP 429.

Run from the project root::

    python3 tests/rate_limit_test.py

Or from inside the tests/ directory::

    python3 rate_limit_test.py
"""

import pathlib
import sys
import time
import unittest

# ---------------------------------------------------------------------------
# Make tools/api_client importable regardless of where this file is invoked.
# ---------------------------------------------------------------------------
_TOOLS = pathlib.Path(__file__).resolve().parent.parent / "tools"
if str(_TOOLS) not in sys.path:
    sys.path.insert(0, str(_TOOLS))

import api_client  # noqa: E402  (import after sys.path mutation is intentional)

# ---------------------------------------------------------------------------
# Target overrides — 127.0.0.1 instead of localhost
# ---------------------------------------------------------------------------
BASE_URL  = "https://127.0.0.1"
LOGIN_URL = f"{BASE_URL}/api/users/login"
SHOW_URL  = f"{BASE_URL}/api/users/show"

USERNAME            = "toto"
PASSWORD            = "toto"
REQUESTS_PER_SECOND = 100   # 10× the server's 10 req/s limit
REQUEST_COUNT       = 100   # one full second burst


# ---------------------------------------------------------------------------
# Integration test
# ---------------------------------------------------------------------------

class RateLimitIntegrationTest(unittest.TestCase):
    """
    Live integration test — requires the server to be running on 127.0.0.1:443.

    Expected outcome
    ----------------
    * Login succeeds and yields a non-empty JWT.
    * At 100 req/s against a 10 req/s ceiling, at least 80 % of the /show
      requests are rejected with HTTP 429.
    * Every single request (success or error) produces printed output.
    """

    @classmethod
    def setUpClass(cls):
        """Login once; share the token across all test methods."""
        cls.ssl_ctx = api_client.make_insecure_ssl_context()
        print(f"\nLogging in as '{USERNAME}' → {LOGIN_URL}")
        cls.token = api_client.login(
            username=USERNAME,
            password=PASSWORD,
            login_url=LOGIN_URL,
            ssl_ctx=cls.ssl_ctx,
        )
        print(f"After Login\n")
        print(f"Login OK — token obtained ({len(cls.token)} chars)\n")

    # ------------------------------------------------------------------
    # Login
    # ------------------------------------------------------------------

    def test_login_returns_non_empty_token(self):
        """setUpClass already logged in; just assert the result is usable."""
        self.assertIsInstance(self.token, str)
        self.assertGreater(len(self.token), 0)

    # ------------------------------------------------------------------
    # Rate-limit burst
    # ------------------------------------------------------------------

    def test_rate_limit_burst(self):
        """
        Fire REQUEST_COUNT requests at REQUESTS_PER_SECOND and verify:

        1.  Every request produces printed output (no silent failures).
        2.  The server returns at least one 200 OK (quota not exhausted at t=0).
        3.  At least 80 % of responses are HTTP 429 (rate limiting active).
        """
        results = _run_burst(
            token=self.token,
            count=REQUEST_COUNT,
            rps=REQUESTS_PER_SECOND,
            show_url=SHOW_URL,
            ssl_ctx=self.ssl_ctx,
        )

        total   = len(results)
        ok_200  = sum(1 for r in results if r["status"] == 200)
        err_429 = sum(1 for r in results if r["status"] == 429)

        print(f"\n--- burst summary ---")
        print(f"  total   : {total}")
        print(f"  200 OK  : {ok_200}")
        print(f"  429     : {err_429}")
        print(f"  other   : {total - ok_200 - err_429}")
        print(f"---------------------\n")

        # Every request must have produced a record.
        self.assertEqual(total, REQUEST_COUNT, "Some requests were silently lost")

        # At least one request must have been served (the server is up).
        self.assertGreater(ok_200, 0, "No 200 OK received — is the server running?")

        # At 100 req/s against a 10 req/s ceiling ≥ 80 % should be rate-limited.
        rate_limited_pct = err_429 / total * 100
        self.assertGreaterEqual(
            rate_limited_pct, 80,
            f"Expected ≥ 80 % HTTP 429, got {rate_limited_pct:.1f} %",
        )


# ---------------------------------------------------------------------------
# Burst helper — records outcome of every request and prints it live
# ---------------------------------------------------------------------------

def _run_burst(
    token: str,
    count: int,
    rps: int,
    show_url: str,
    ssl_ctx,
) -> list:
    """
    Send *count* requests at *rps* requests-per-second.

    Every response (success or error) is printed immediately and recorded in
    the returned list of dicts::

        {"index": int, "status": int, "body": str}
    """
    import urllib.error
    import urllib.request
    import json

    interval = 1.0 / rps
    bearer   = api_client.build_bearer_header(token)
    results  = []

    print(f"Firing {count} requests at {rps} req/s → {show_url}\n")

    for i in range(count):
        req = urllib.request.Request(show_url, method="GET")
        req.add_header("Authorization", bearer)
        req.add_header("Accept", "application/json")

        try:
            with urllib.request.urlopen(req, context=ssl_ctx) as resp:
                raw  = resp.read().decode()
                body = json.dumps(json.loads(raw), indent=2)
                print(f"[{i + 1:>3}/{count}] 200 OK: {body}")
                results.append({"index": i + 1, "status": 200, "body": body})

        except urllib.error.HTTPError as exc:
            try:
                error_body = exc.read().decode()
            except Exception:
                error_body = "(no body)"
            print(f"[{i + 1:>3}/{count}] HTTP {exc.code} {exc.reason}: {error_body}")
            results.append({"index": i + 1, "status": exc.code, "body": error_body})

        except urllib.error.URLError as exc:
            msg = f"Network error: {exc.reason}"
            print(f"[{i + 1:>3}/{count}] {msg}")
            results.append({"index": i + 1, "status": 0, "body": msg})

        if i < count - 1:
            time.sleep(interval)

    return results


# ---------------------------------------------------------------------------
# Entry point — can also be run directly without pytest
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    unittest.main(verbosity=2)
