import { useEffect, useRef, useState } from "react";
import { getCredentials } from "../api";

export interface UseWebSocketOptions<T> {
  onOpen?: () => void;
  onMessage?: (message: T) => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  /**
   * Opt in to automatic reconnection after an unexpected close, with exponential
   * backoff starting at 500ms and capped at this many milliseconds.
   *
   * Omit it and the socket stays one-shot. That matters because the server
   * compiles on container start and can be unreachable for minutes while the
   * frontend is already serving — a socket opened in that window dies with a
   * 502 and, without this, never retries. Left opt-in so a reconnect cannot
   * silently re-enter game matchmaking mid-match.
   */
  reconnectMaxDelayMs?: number;
}

const RECONNECT_BASE_DELAY_MS = 500;

/**
 * A custom React hook that abstracts and manages standard WebSocket connections.
 * Appends the provided `queryParams` to the URL query string, and (if present)
 * forwards the user's Basic Auth credentials via a WebSocket subprotocol.
 * Credentials are passed as a hex-encoded `auth-` subprotocol, since browsers
 * cannot set an Authorization header on a WebSocket handshake.
 */
export function useWebSocket<IncomingMessage = any, OutgoingMessage = any>(
  path: string | null,
  queryParams: Record<string, string | number>,
  options: UseWebSocketOptions<IncomingMessage> = {},
) {
  const wsRef = useRef<WebSocket | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  // Bumping this re-runs the effect, which is how a retry actually reconnects.
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const attemptRef = useRef(0);

  useEffect(() => {
    if (!path) return;
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const creds = getCredentials();

    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(queryParams)) {
      params.append(key, String(val));
    }

    const wsUrl = `${wsProtocol}//${window.location.host}${apiBaseUrl}${path}?${params.toString()}`;

    // Pass authentication token via Sec-WebSocket-Protocol (hex-encoded to satisfy RFC grammar constraints)
    const subprotocols: string[] = [];
    if (creds) {
      const hex = Array.from(new TextEncoder().encode(creds))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
      subprotocols.push(`auth-${hex}`);
    }

    const ws = new WebSocket(wsUrl, subprotocols);
    wsRef.current = ws;

    // Set by the cleanup below so a deliberate teardown (unmount, logout, param
    // change) is never mistaken for a dropped connection worth retrying.
    let tornDown = false;
    let retryTimer: number | undefined;

    function scheduleReconnect() {
      const maxDelay = optionsRef.current.reconnectMaxDelayMs;
      if (!maxDelay || tornDown) return;
      attemptRef.current += 1;
      const delay = Math.min(
        maxDelay,
        RECONNECT_BASE_DELAY_MS * 2 ** (attemptRef.current - 1),
      );
      retryTimer = window.setTimeout(
        () => setReconnectAttempt((n) => n + 1),
        delay,
      );
    }

    ws.onopen = () => {
      attemptRef.current = 0; // a good connection resets the backoff
      if (optionsRef.current.onOpen) {
        optionsRef.current.onOpen();
      }
    };

    ws.onmessage = (event) => {
      if (optionsRef.current.onMessage) {
        try {
          const msg = JSON.parse(event.data);
          optionsRef.current.onMessage(msg);
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      }
    };

    // onerror is always followed by onclose, so retrying here covers both a
    // failed handshake (server down, 401) and a mid-session drop.
    ws.onclose = () => {
      if (optionsRef.current.onClose) {
        optionsRef.current.onClose();
      }
      scheduleReconnect();
    };

    ws.onerror = (error) => {
      if (optionsRef.current.onError) {
        optionsRef.current.onError(error);
      }
    };

    return () => {
      tornDown = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [path, JSON.stringify(queryParams), reconnectAttempt]);

  const sendMessage = (message: OutgoingMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket is not open. Message not sent:", message);
    }
  };

  return {
    sendMessage,
    close: () => wsRef.current?.close(),
    readyState: wsRef.current?.readyState ?? WebSocket.CLOSED,
  };
}
