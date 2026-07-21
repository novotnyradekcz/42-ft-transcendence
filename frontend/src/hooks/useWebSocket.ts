import { useEffect, useRef } from "react";
import { getCredentials } from "../api";

export interface UseWebSocketOptions<T> {
  onOpen?: () => void;
  onMessage?: (message: T) => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

/**
 * A custom React hook that abstracts and manages standard WebSocket connections.
 * Automatically appends the user's current session credentials and other parameters
 * to the query string for authentication.
 */
export function useWebSocket<IncomingMessage = any, OutgoingMessage = any>(
  path: string | null,
  queryParams: Record<string, string | number>,
  options: UseWebSocketOptions<IncomingMessage> = {},
) {
  const wsRef = useRef<WebSocket | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

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

    ws.onopen = () => {
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

    ws.onclose = () => {
      if (optionsRef.current.onClose) {
        optionsRef.current.onClose();
      }
    };

    ws.onerror = (error) => {
      if (optionsRef.current.onError) {
        optionsRef.current.onError(error);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [path, JSON.stringify(queryParams)]);

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
