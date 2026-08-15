import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useSession } from "../session/useSession";
import { StatusContext } from "./useStatus";
import type { StatusClientMessage, StatusServerMessage } from "./types";

// ping interval, also the refresh rate since the server never pushes
const KEEPALIVE_MS = 30_000;

// reconnect backoff cap, the server can be unreachable right after startup
const RECONNECT_MAX_DELAY_MS = 10_000;

// opens one status socket per logged-in tab and tracks who's online
// closing the socket is what tells the server this user went offline
export function StatusProvider({ children }: { children: ReactNode }) {
  const { sessionUser } = useSession();
  const [onlineIds, setOnlineIds] = useState<Set<number>>(() => new Set());
  const [connected, setConnected] = useState(false);

  const userId = sessionUser?.id ?? null;

  // a null path keeps the hook dormant, so guests never open a socket
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
        // no socket means we know nothing, assume offline rather than stale
        setOnlineIds(new Set());
      },
      onError: () => setConnected(false),
      reconnectMaxDelayMs: RECONNECT_MAX_DELAY_MS,
    },
  );

  // each ping is answered with a full snapshot
  useEffect(() => {
    if (!connected) return;
    const timer = window.setInterval(() => {
      sendMessage({ type: "ping" });
    }, KEEPALIVE_MS);
    return () => window.clearInterval(timer);
    // sendMessage reads a ref internally, safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const statusOf = useCallback(
    (id: number): "online" | "offline" => (onlineIds.has(id) ? "online" : "offline"),
    [onlineIds],
  );

  const value = useMemo(() => ({ statusOf }), [statusOf]);

  return (
    <StatusContext.Provider value={value}>{children}</StatusContext.Provider>
  );
}
