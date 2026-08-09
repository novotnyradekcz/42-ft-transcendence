import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useSession } from "../session/useSession";
import { StatusContext } from "./useStatus";
import type { StatusClientMessage, StatusServerMessage } from "./types";

/**
 * Ping interval. Doubles as the keepalive (stops proxies reaping an idle socket)
 * and as the only refresh path, since the server never pushes — status is accurate
 * to within this interval.
 */
const KEEPALIVE_MS = 30_000;

/**
 * Reconnect backoff cap. The server compiles on container start and can refuse
 * connections for minutes while nginx is already serving the app, so the first
 * socket of a session often fails — without retrying, everyone shows offline
 * until a manual reload.
 */
const RECONNECT_MAX_DELAY_MS = 10_000;

/**
 * Opens one status WebSocket per logged-in tab and tracks who's online.
 * Runtime state only — the socket closing (on logout, when the path goes null)
 * is what tells the server this user went offline.
 */
export function StatusProvider({ children }: { children: ReactNode }) {
  const { sessionUser } = useSession();
  const [onlineIds, setOnlineIds] = useState<Set<number>>(() => new Set());
  const [connected, setConnected] = useState(false);

  const userId = sessionUser?.id ?? null;

  // A null path keeps the hook dormant, so guests never open a socket.
  const { sendMessage } = useWebSocket<
    StatusServerMessage,
    StatusClientMessage
  >(
    userId === null ? null : "/status/ws",
    userId === null ? {} : { user_id: userId },
    {
      onOpen: () => setConnected(true),
      onMessage: (message) => {
        if (message.type === "status_init") {
          setOnlineIds(new Set(message.online));
        }
      },
      onClose: () => {
        setConnected(false);
        // No socket means we know nothing — assume offline rather than stale-online.
        setOnlineIds(new Set());
      },
      onError: () => setConnected(false),
      reconnectMaxDelayMs: RECONNECT_MAX_DELAY_MS,
    },
  );

  // Keepalive doubling as the refresh: each ping is answered with a full snapshot.
  useEffect(() => {
    if (!connected) return;
    const timer = window.setInterval(() => {
      sendMessage({ type: "ping" });
    }, KEEPALIVE_MS);
    return () => window.clearInterval(timer);
    // sendMessage reads a ref internally and is safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const isOnline = useCallback(
    (id: number) => onlineIds.has(id),
    [onlineIds],
  );

  const statusOf = useCallback(
    (id: number): "online" | "offline" => (onlineIds.has(id) ? "online" : "offline"),
    [onlineIds],
  );

  const value = useMemo(
    () => ({ onlineIds, connected, isOnline, statusOf }),
    [onlineIds, connected, isOnline, statusOf],
  );

  return (
    <StatusContext.Provider value={value}>{children}</StatusContext.Provider>
  );
}
