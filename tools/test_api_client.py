"""
Tests for api_client.py — written first (TDD).

Unit tests cover each helper function in isolation.
Integration tests cover the end-to-end flow with mocked HTTP.
Both happy-path and edge-case scenarios are covered.

Rate-limit scenario:
  The server enforces 10 req/s.  The client fires 20 req/s, so roughly half
  the responses should be HTTP 429 Too Many Requests.
"""

import base64
import io
import json
import sys
import unittest
from io import BytesIO
from unittest.mock import MagicMock, call, patch

import api_client


class _CaptureOutput:
    """Context manager that captures stdout for assertions while also echoing
    every line to the real terminal (sys.__stdout__), so output remains
    visible when running under pytest.

    Usage::

        with _CaptureOutput() as cap:
            perform_requests(...)
        self.assertIn("200", cap.output)
    """

    def __enter__(self):
        self._buf = io.StringIO()
        self._saved = sys.stdout
        sys.stdout = self
        return self

    def write(self, text: str) -> int:
        self._buf.write(text)
        real = getattr(sys, "__stdout__", None)
        if real is not None:
            real.write(text)
            real.flush()
        return len(text)

    def flush(self):
        real = getattr(sys, "__stdout__", None)
        if real is not None:
            real.flush()

    def __exit__(self, *_):
        sys.stdout = self._saved
        self.output = self._buf.getvalue()
        self.lines = [l for l in self.output.splitlines() if l.strip()]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_response(body: dict, status: int = 200) -> MagicMock:
    """Return a mock that behaves like the context-manager object from urlopen."""
    mock_resp = MagicMock()
    mock_resp.status = status
    mock_resp.read.return_value = json.dumps(body).encode()
    mock_resp.__enter__ = lambda s: s
    mock_resp.__exit__ = MagicMock(return_value=False)
    return mock_resp


def _make_http_error(code: int, msg: str, body: bytes = b"") -> "urllib.error.HTTPError":
    import urllib.error
    return urllib.error.HTTPError(
        url=api_client.SHOW_URL,
        code=code,
        msg=msg,
        hdrs=None,
        fp=BytesIO(body),
    )


# ---------------------------------------------------------------------------
# Unit tests
# ---------------------------------------------------------------------------

class TestBuildBasicAuthHeader(unittest.TestCase):
    """build_basic_auth_header(username, password) -> 'Basic <b64>'"""

    def test_happy_path(self):
        header = api_client.build_basic_auth_header("test", "test")
        expected_b64 = base64.b64encode(b"test:test").decode()
        self.assertEqual(header, f"Basic {expected_b64}")

    def test_special_characters_in_credentials(self):
        header = api_client.build_basic_auth_header("user@domain", "p@$$w0rd!")
        raw = base64.b64decode(header.split(" ", 1)[1]).decode()
        self.assertEqual(raw, "user@domain:p@$$w0rd!")

    def test_empty_password(self):
        header = api_client.build_basic_auth_header("admin", "")
        raw = base64.b64decode(header.split(" ", 1)[1]).decode()
        self.assertEqual(raw, "admin:")

    def test_empty_username(self):
        header = api_client.build_basic_auth_header("", "secret")
        raw = base64.b64decode(header.split(" ", 1)[1]).decode()
        self.assertEqual(raw, ":secret")

    def test_prefix_is_basic(self):
        header = api_client.build_basic_auth_header("u", "p")
        self.assertTrue(header.startswith("Basic "))


class TestBuildBearerHeader(unittest.TestCase):
    """build_bearer_header(token) -> 'Bearer <base64(token)>'"""

    def test_happy_path(self):
        jwt = "header.payload.signature"
        header = api_client.build_bearer_header(jwt)
        expected_b64 = base64.b64encode(jwt.encode()).decode()
        self.assertEqual(header, f"Bearer {expected_b64}")

    def test_prefix_is_bearer(self):
        header = api_client.build_bearer_header("sometoken")
        self.assertTrue(header.startswith("Bearer "))

    def test_roundtrip_decode(self):
        jwt = "a.b.c"
        header = api_client.build_bearer_header(jwt)
        b64_part = header.split(" ", 1)[1]
        decoded = base64.b64decode(b64_part).decode()
        self.assertEqual(decoded, jwt)

    def test_empty_token_raises(self):
        with self.assertRaises(ValueError):
            api_client.build_bearer_header("")


class TestExtractAccessToken(unittest.TestCase):
    """extract_access_token(body: dict) -> str"""

    def test_happy_path(self):
        body = {
            "access_token": "jwt.token.here",
            "token_type": "Bearer",
            "expires_in": 600,
        }
        self.assertEqual(api_client.extract_access_token(body), "jwt.token.here")

    def test_missing_key_raises(self):
        with self.assertRaises(KeyError):
            api_client.extract_access_token({"token_type": "Bearer"})

    def test_empty_token_value_raises(self):
        with self.assertRaises(ValueError):
            api_client.extract_access_token({"access_token": ""})

    def test_none_token_value_raises(self):
        with self.assertRaises(ValueError):
            api_client.extract_access_token({"access_token": None})


class TestMakeInsecureContext(unittest.TestCase):
    """make_insecure_ssl_context() returns an SSL context that skips verification."""

    def test_returns_ssl_context(self):
        import ssl
        ctx = api_client.make_insecure_ssl_context()
        self.assertIsInstance(ctx, ssl.SSLContext)

    def test_check_hostname_disabled(self):
        ctx = api_client.make_insecure_ssl_context()
        self.assertFalse(ctx.check_hostname)


# ---------------------------------------------------------------------------
# Integration tests — login
# ---------------------------------------------------------------------------

class TestLogin(unittest.TestCase):
    """login(username, password, login_url, ssl_ctx) -> access_token string"""

    @patch("urllib.request.urlopen")
    def test_happy_path_returns_access_token(self, mock_urlopen):
        mock_urlopen.return_value = _make_response(
            {"access_token": "jwt.token.value", "token_type": "Bearer", "expires_in": 600}
        )
        token = api_client.login("test", "test")
        self.assertEqual(token, "jwt.token.value")

    @patch("urllib.request.urlopen")
    def test_request_uses_basic_auth_header(self, mock_urlopen):
        mock_urlopen.return_value = _make_response({"access_token": "tok"})
        api_client.login("test", "test")

        request_arg = mock_urlopen.call_args[0][0]
        auth_header = request_arg.get_header("Authorization")
        expected_b64 = base64.b64encode(b"test:test").decode()
        self.assertEqual(auth_header, f"Basic {expected_b64}")

    @patch("urllib.request.urlopen")
    def test_request_targets_login_url(self, mock_urlopen):
        mock_urlopen.return_value = _make_response({"access_token": "tok"})
        api_client.login("test", "test")

        request_arg = mock_urlopen.call_args[0][0]
        self.assertEqual(request_arg.full_url, api_client.LOGIN_URL)

    @patch("urllib.request.urlopen")
    def test_http_error_raises_runtime_error(self, mock_urlopen):
        import urllib.error
        mock_urlopen.side_effect = urllib.error.HTTPError(
            url=api_client.LOGIN_URL, code=401,
            msg="Unauthorized", hdrs=None, fp=None
        )
        with self.assertRaises(RuntimeError):
            api_client.login("wrong", "creds")

    @patch("urllib.request.urlopen")
    def test_missing_access_token_in_response_raises(self, mock_urlopen):
        mock_urlopen.return_value = _make_response({"token_type": "Bearer"})
        with self.assertRaises(KeyError):
            api_client.login("test", "test")


# ---------------------------------------------------------------------------
# Integration tests — perform_requests
# ---------------------------------------------------------------------------

class TestPerformRequests(unittest.TestCase):
    """perform_requests(token, count, requests_per_second) basics."""

    @patch("time.sleep")
    @patch("urllib.request.urlopen")
    def test_correct_number_of_requests(self, mock_urlopen, mock_sleep):
        mock_urlopen.return_value = _make_response({"users": []})
        api_client.perform_requests("jwt.token", count=5, requests_per_second=60)
        self.assertEqual(mock_urlopen.call_count, 5)

    @patch("time.sleep")
    @patch("urllib.request.urlopen")
    def test_bearer_header_is_base64_encoded_token(self, mock_urlopen, mock_sleep):
        mock_urlopen.return_value = _make_response({"users": []})
        api_client.perform_requests("my.jwt.token", count=1, requests_per_second=60)

        request_arg = mock_urlopen.call_args[0][0]
        auth_header = request_arg.get_header("Authorization")
        expected_b64 = base64.b64encode(b"my.jwt.token").decode()
        self.assertEqual(auth_header, f"Bearer {expected_b64}")

    @patch("time.sleep")
    @patch("urllib.request.urlopen")
    def test_request_targets_show_url(self, mock_urlopen, mock_sleep):
        mock_urlopen.return_value = _make_response({"users": []})
        api_client.perform_requests("tok", count=1, requests_per_second=60)

        request_arg = mock_urlopen.call_args[0][0]
        self.assertEqual(request_arg.full_url, api_client.SHOW_URL)

    @patch("time.sleep")
    @patch("urllib.request.urlopen")
    def test_sleep_interval_matches_rps(self, mock_urlopen, mock_sleep):
        """With requests_per_second=20 the interval between requests is 1/20 = 0.05 s."""
        mock_urlopen.return_value = _make_response({"users": []})
        api_client.perform_requests("tok", count=3, requests_per_second=20)
        expected_interval = 1.0 / 20
        for c in mock_sleep.call_args_list:
            self.assertAlmostEqual(c[0][0], expected_interval, places=5)

    @patch("time.sleep")
    @patch("urllib.request.urlopen")
    def test_no_sleep_after_last_request(self, mock_urlopen, mock_sleep):
        mock_urlopen.return_value = _make_response({"users": []})
        n = 4
        api_client.perform_requests("tok", count=n, requests_per_second=60)
        self.assertEqual(mock_sleep.call_count, n - 1)

    @patch("time.sleep")
    @patch("urllib.request.urlopen")
    def test_zero_count_sends_no_requests(self, mock_urlopen, mock_sleep):
        api_client.perform_requests("tok", count=0, requests_per_second=60)
        mock_urlopen.assert_not_called()
        mock_sleep.assert_not_called()


class TestPerformRequestsOutput(unittest.TestCase):
    """Verify that both success and error responses are printed to stdout."""

    @patch("time.sleep")
    @patch("urllib.request.urlopen")
    def test_success_response_is_printed(self, mock_urlopen, mock_sleep):
        mock_urlopen.return_value = _make_response({"users": [{"id": 1}]})
        with _CaptureOutput() as cap:
            api_client.perform_requests("tok", count=1, requests_per_second=60)
        self.assertIn("200", cap.output)

    @patch("time.sleep")
    @patch("urllib.request.urlopen")
    def test_http_error_body_is_printed_to_stdout(self, mock_urlopen, mock_sleep):
        mock_urlopen.side_effect = _make_http_error(
            429, "Too Many Requests", b'{"error": "rate limit exceeded"}'
        )
        with _CaptureOutput() as cap:
            api_client.perform_requests("tok", count=1, requests_per_second=60)
        self.assertIn("429", cap.output)
        self.assertIn("Too Many Requests", cap.output)

    @patch("time.sleep")
    @patch("urllib.request.urlopen")
    def test_network_error_is_printed(self, mock_urlopen, mock_sleep):
        import urllib.error
        mock_urlopen.side_effect = urllib.error.URLError("Connection refused")
        with _CaptureOutput() as cap:
            api_client.perform_requests("tok", count=1, requests_per_second=60)
        self.assertIn("Network error", cap.output)


# ---------------------------------------------------------------------------
# Rate-limit scenario test
# ---------------------------------------------------------------------------

class TestRateLimitScenario(unittest.TestCase):
    """
    Simulate firing 20 req/s against a server whose limit is 10 req/s.

    The server accepts the first 10 requests of each second window and rejects
    the remaining 10 with HTTP 429.  All responses — successes and errors alike
    — must be printed so the operator can observe the throttling in real time.
    """

    def _build_side_effects(self, total: int = 20) -> list:
        """Alternate success / 429 to model a 50 % rejection rate."""
        effects = []
        for i in range(total):
            if i % 2 == 0:
                effects.append(_make_response({"users": [{"id": i}]}))
            else:
                effects.append(_make_http_error(
                    429,
                    "Too Many Requests",
                    b'{"error": "rate limit exceeded"}',
                ))
        return effects

    @patch("time.sleep")
    @patch("urllib.request.urlopen")
    def test_all_20_requests_are_attempted(self, mock_urlopen, mock_sleep):
        mock_urlopen.side_effect = self._build_side_effects(20)
        api_client.perform_requests("tok", count=20, requests_per_second=20)
        self.assertEqual(mock_urlopen.call_count, 20)

    @patch("time.sleep")
    @patch("urllib.request.urlopen")
    def test_successful_responses_are_printed(self, mock_urlopen, mock_sleep):
        mock_urlopen.side_effect = self._build_side_effects(20)
        with _CaptureOutput() as cap:
            api_client.perform_requests("tok", count=20, requests_per_second=20)
        ok_lines = [l for l in cap.lines if "200 OK" in l]
        self.assertEqual(len(ok_lines), 10)

    @patch("time.sleep")
    @patch("urllib.request.urlopen")
    def test_rate_limited_responses_are_printed(self, mock_urlopen, mock_sleep):
        mock_urlopen.side_effect = self._build_side_effects(20)
        with _CaptureOutput() as cap:
            api_client.perform_requests("tok", count=20, requests_per_second=20)
        err_lines = [l for l in cap.lines if "429" in l]
        self.assertEqual(len(err_lines), 10)

    @patch("time.sleep")
    @patch("urllib.request.urlopen")
    def test_all_20_responses_produce_a_printed_line(self, mock_urlopen, mock_sleep):
        """Every request — regardless of outcome — must produce exactly one response header line.

        Success bodies are pretty-printed JSON (multiple lines), so we count only
        lines that open with the '[N/20]' request prefix rather than all output lines.
        """
        mock_urlopen.side_effect = self._build_side_effects(20)
        with _CaptureOutput() as cap:
            api_client.perform_requests("tok", count=20, requests_per_second=20)
        header_lines = [l for l in cap.lines if l.startswith("[")]
        self.assertEqual(len(header_lines), 20)

    @patch("time.sleep")
    @patch("urllib.request.urlopen")
    def test_interval_between_requests_is_1_over_rps(self, mock_urlopen, mock_sleep):
        """At 20 req/s the sleep interval must be 1/20 = 0.05 s."""
        mock_urlopen.side_effect = self._build_side_effects(20)
        api_client.perform_requests("tok", count=20, requests_per_second=20)

        expected = 1.0 / 20
        self.assertEqual(mock_sleep.call_count, 19)   # not after the last request
        for c in mock_sleep.call_args_list:
            self.assertAlmostEqual(c[0][0], expected, places=5)


if __name__ == "__main__":
    unittest.main()
