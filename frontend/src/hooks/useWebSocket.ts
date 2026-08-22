// One websocket, opened and closed by the lifetime of the component using it.
//
// Two consumers with different needs: StatusProvider wants a connection that
// comes back after the server restarts, GamePlayPage wants a closed socket to
// stay closed so a finished match isn't silently rejoined — hence reconnection
// being opt-in rather than the default.
//
// The browser won't let a handshake carry headers, so the auth token goes over
// as a subprotocol instead. See the encoding below.

import { useEffect, useRef, useState } from "react";
import { authHeader } from "../api";

export interface UseWebSocketOptions<T> {
  onOpen?: () => void;
  onMessage?: (message: T) => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  // opt in to reconnecting after an unexpected close, backoff capped at this
  // omit it and the socket stays one-shot
  reconnectMaxDelayMs?: number;
}

// first retry waits this long, then it doubles up to reconnectMaxDelayMs
const RECONNECT_BASE_DELAY_MS = 500;

// manages a websocket connection, null path keeps it closed
export function useWebSocket<IncomingMessage = unknown, OutgoingMessage = unknown>(
  path: string | null,
  queryParams: Record<string, string | number>,
  options: UseWebSocketOptions<IncomingMessage> = {},
) {
  const wsRef = useRef<WebSocket | null>(null);
  // callbacks are read through a ref so the effect doesn't list them as
  // dependencies — consumers pass fresh closures every render, and depending on
  // them would tear the socket down and reopen it on each one
  const optionsRef = useRef(options);
  // written in an effect because writing a ref mid-render is unsafe
  useEffect(() => {
    optionsRef.current = options;
  });
  // bumping this re-runs the effect, which is how a retry reconnects
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const attemptRef = useRef(0);
  // kept in state so consumers re-render on it, unlike ws.readyState
  const [readyState, setReadyState] = useState<number>(
    path ? WebSocket.CONNECTING : WebSocket.CLOSED,
  );

  useEffect(() => {
    if (!path) return;
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // same header the http path sends, built once in api.ts
    const creds = authHeader();

    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(queryParams)) {
      params.append(key, String(val));
    }

    const wsUrl = `${wsProtocol}//${window.location.host}${apiBaseUrl}${path}?${params.toString()}`;

    // browsers can't set headers on a handshake, so the token rides along
    // as a hex-encoded subprotocol
    const subprotocols: string[] = [];
    if (creds) {
      const hex = Array.from(new TextEncoder().encode(creds))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
      subprotocols.push(`auth-${hex}`);
    }

    const ws = new WebSocket(wsUrl, subprotocols);
    wsRef.current = ws;
    // the server must echo the auth-<hex> subprotocol back for the handshake to
    // complete; a rejected token surfaces as a plain close, not an http status

    // set by the cleanup, so a deliberate teardown isn't retried
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
      setReadyState(WebSocket.OPEN);
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

    // onerror is always followed by onclose, so retrying here covers both
    ws.onclose = () => {
      setReadyState(WebSocket.CLOSED);
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
    // queryParams is compared by value, not identity: callers build it inline,
    // so a fresh object every render would reopen the socket every render. The
    // lint rule can't see through the stringify and warns; that's expected.
  }, [path, JSON.stringify(queryParams), reconnectAttempt]);

  // dropped rather than queued when the socket is down: both consumers send
  // state that's stale by the time a reconnect lands — a keepalive ping and a
  // game move — so replaying it would be worse than losing it
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
    readyState,
  };
}
