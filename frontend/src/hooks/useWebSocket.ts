import { useEffect, useRef, useState, useCallback } from "react";

export type WebSocketConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

interface UseWebSocketOptions {
  onMessage?: (data: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: Event) => void;
}

export function useWebSocket(path: string, options?: UseWebSocketOptions) {
  const [status, setStatus] = useState<WebSocketConnectionStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const optionsRef = useRef(options);

  // Keep options ref updated so callbacks can change without restarting the connection
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (!path) {
      Promise.resolve().then(() => {
        setStatus("disconnected");
      });
      return;
    }

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}${apiBaseUrl}${path}`;
    
    Promise.resolve().then(() => {
      setStatus("connecting");
    });
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      if (optionsRef.current?.onOpen) {
        optionsRef.current.onOpen();
      }
    };

    ws.onmessage = (event) => {
      if (optionsRef.current?.onMessage) {
        optionsRef.current.onMessage(event.data);
      }
    };

    ws.onclose = () => {
      setStatus("disconnected");
      if (optionsRef.current?.onClose) {
        optionsRef.current.onClose();
      }
    };

    ws.onerror = (err) => {
      setStatus("error");
      if (optionsRef.current?.onError) {
        optionsRef.current.onError(err);
      }
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [path]);

  const sendMessage = useCallback((data: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
      return true;
    }
    return false;
  }, []);

  return {
    status,
    sendMessage,
  };
}
