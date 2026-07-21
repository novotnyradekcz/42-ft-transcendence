import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuaFactory } from "wasmoon";
import { useSession } from "./context/session/useSession";
import { useTranslation } from "./context/language/i18n";
import { PAGE_PATHS } from "./router";
import type { GameSummary } from "./types";
import { getCredentials } from "./api";

const GRID_COLS = 40;
const GRID_ROWS = 20;

const createEmptyGrid = () =>
  Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => ({
      char: " ",
      color: "green",
    })),
  );

type Cell = {
  char: string;
  color: string;
};

export default function GamePlayPage({ game }: { game: GameSummary | null }) {
  const { sessionUser } = useSession();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [grid, setGrid] = useState<Cell[]>(() => {
    const flat: Cell[] = [];
    const empty = createEmptyGrid();
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        flat.push({ ...empty[r][c] });
      }
    }
    return flat;
  });
  const [status, setStatus] = useState<
    "connecting" | "waiting" | "playing" | "disconnected" | "error"
  >("connecting");
  const [statusMessage, setStatusMessage] = useState(t("Connecting to server..."));

  const wsRef = useRef<WebSocket | null>(null);
  const luaEngineRef = useRef<any>(null);
  const gridRef = useRef<Cell[][]>(createEmptyGrid());
  const statusRef = useRef(status);
  const tRef = useRef(t);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const forceUpdate = () => {
    const flat: Cell[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        flat.push({ ...gridRef.current[r][c] });
      }
    }
    setGrid(flat);
  };

  const cleanupLua = () => {
    if (luaEngineRef.current) {
      try {
        luaEngineRef.current.global.close();
      } catch (e) {
        console.error("Error closing Lua global:", e);
      }
      luaEngineRef.current = null;
    }
  };

  const handleCellClick = async (x: number, y: number) => {
    if (statusRef.current !== "playing" || !luaEngineRef.current) {
      return;
    }

    try {
      const luaOnClick = luaEngineRef.current.global.get("on_click");
      if (luaOnClick) {
        await luaOnClick(x, y);
        forceUpdate();
      }
    } catch (err) {
      console.error("Error in on_click:", err);
    }
  };

  useEffect(() => {
    if (!game || !sessionUser) {
      setStatus("error");
      setStatusMessage(tRef.current("Game or session details missing."));
      return;
    }

    gridRef.current = createEmptyGrid();
    forceUpdate();

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const creds = getCredentials();
    const wsUrl = `${wsProtocol}//${window.location.host}${apiBaseUrl}/games/play/ws?game_id=${game.id}&user_id=${sessionUser.id}${creds ? `&auth=${encodeURIComponent(creds)}` : ""}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connecting");
      setStatusMessage(tRef.current("Connected, searching for an opponent..."));
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "match_waiting") {
          setStatus("waiting");
          setStatusMessage(tRef.current("Waiting for an opponent to join..."));
        } else if (msg.type === "match_start") {
          setStatus("playing");
          setStatusMessage(
            tRef.current("Playing vs {name}", { name: msg.opponent_name }),
          );

          cleanupLua();

          const factory = new LuaFactory("/glue.wasm");
          const lua = await factory.createEngine();
          luaEngineRef.current = lua;

          lua.global.set(
            "draw_cell",
            (x: number, y: number, text: string, color: string) => {
              const r = y - 1;
              const cStart = x - 1;
              if (r >= 0 && r < GRID_ROWS) {
                const str = String(text ?? " ");
                for (let i = 0; i < str.length; i++) {
                  const c = cStart + i;
                  if (c >= 0 && c < GRID_COLS) {
                    gridRef.current[r][c] = {
                      char: str[i],
                      color: color || "green",
                    };
                  }
                }
              }
            },
          );

          lua.global.set("clear_screen", () => {
            gridRef.current = createEmptyGrid();
          });

          lua.global.set("send_message", (payload: string) => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({ type: "game_action", data: payload }),
              );
            }
          });

          lua.global.set("player_index", msg.player_index);

          await lua.doString(msg.script);
          forceUpdate();
        } else if (msg.type === "game_action") {
          if (luaEngineRef.current) {
            const onNetworkMessage =
              luaEngineRef.current.global.get("on_network_message");
            if (onNetworkMessage) {
              await onNetworkMessage(msg.data);
              forceUpdate();
            }
          }
        } else if (msg.type === "opponent_disconnected") {
          setStatus("disconnected");
          setStatusMessage(tRef.current("Opponent disconnected. Game ended."));
          cleanupLua();
        }
      } catch (err) {
        console.error("Error in onmessage:", err);
      }
    };

    ws.onclose = () => {
      if (statusRef.current !== "disconnected") {
        setStatus("disconnected");
        setStatusMessage(tRef.current("Connection to server closed."));
      }
      cleanupLua();
    };

    ws.onerror = () => {
      setStatus("error");
      setStatusMessage(tRef.current("WebSocket connection error."));
      cleanupLua();
    };

    return () => {
      cleanupLua();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [game, sessionUser]);

  return (
    <div className="game-play-container">
      <div className="game-status-bar">
        <span className="game-title">{game?.name}</span>
        <span className="game-msg">{statusMessage}</span>
        <button
          type="button"
          className="terminal-button back-btn"
          onClick={() => navigate(PAGE_PATHS.games)}
        >
          {t("Exit Game")}
        </button>
      </div>

      <div className="terminal-grid-wrapper">
        <div className="terminal-grid">
          {grid.map((cell, idx) => {
            const x = (idx % GRID_COLS) + 1;
            const y = Math.floor(idx / GRID_COLS) + 1;
            return (
              <span
                key={idx}
                className="terminal-cell"
                style={{ color: cell.color }}
                onClick={() => handleCellClick(x, y)}
              >
                {cell.char}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
