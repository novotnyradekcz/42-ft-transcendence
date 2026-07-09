import { useEffect, useRef, useState } from "react";
import { LuaFactory } from "wasmoon";
import type { GameSummary, SessionUser } from "./types";

const GRID_COLS = 40;
const GRID_ROWS = 20;

const createEmptyGrid = () =>
  Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => ({
      char: " ",
      color: "green",
    }))
  );

type Cell = {
  char: string;
  color: string;
};

export default function GamePlayPage({
  game,
  sessionUser,
  onBack,
}: {
  game: GameSummary | null;
  sessionUser: SessionUser | null;
  onBack: () => void;
}) {
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
  const [status, setStatus] = useState<"connecting" | "waiting" | "playing" | "disconnected" | "error">("connecting");
  const [statusMessage, setStatusMessage] = useState("Connecting to server...");

  const wsRef = useRef<WebSocket | null>(null);
  const luaEngineRef = useRef<any>(null);
  const gridRef = useRef<Cell[][]>(createEmptyGrid());
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

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
      setStatusMessage("Game or session details missing.");
      return;
    }

    // Reset grid
    gridRef.current = createEmptyGrid();
    forceUpdate();

    // Setup WebSocket
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}${apiBaseUrl}/games/play/ws?game_id=${game.id}&user_id=${sessionUser.id}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connecting");
      setStatusMessage("Connected, searching for an opponent...");
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "match_waiting") {
          setStatus("waiting");
          setStatusMessage("Waiting for an opponent to join...");
        } else if (msg.type === "match_start") {
          setStatus("playing");
          setStatusMessage(`Playing vs ${msg.opponent_name}`);

          cleanupLua();

          // Load Lua via factory pointing to the public WASM glue
          const factory = new LuaFactory("/glue.wasm");
          const lua = await factory.createEngine();
          luaEngineRef.current = lua;

          // Expose draw_cell (1-indexed for Lua, maps to 0-indexed JS array)
          lua.global.set("draw_cell", (x: number, y: number, text: string, color: string) => {
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
          });

          // Expose clear_screen
          lua.global.set("clear_screen", () => {
            gridRef.current = createEmptyGrid();
          });

          // Expose send_message
          lua.global.set("send_message", (payload: string) => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({ type: "game_action", data: payload })
              );
            }
          });

          // Expose player_index (1 or 2)
          lua.global.set("player_index", msg.player_index);

          // Execute script
          await lua.doString(msg.script);
          forceUpdate();
        } else if (msg.type === "game_action") {
          if (luaEngineRef.current) {
            const onNetworkMessage = luaEngineRef.current.global.get("on_network_message");
            if (onNetworkMessage) {
              await onNetworkMessage(msg.data);
              forceUpdate();
            }
          }
        } else if (msg.type === "opponent_disconnected") {
          setStatus("disconnected");
          setStatusMessage("Opponent disconnected. Game ended.");
          cleanupLua();
        }
      } catch (err) {
        console.error("Error in onmessage:", err);
      }
    };

    ws.onclose = () => {
      if (statusRef.current !== "disconnected") {
        setStatus("disconnected");
        setStatusMessage("Connection to server closed.");
      }
      cleanupLua();
    };

    ws.onerror = () => {
      setStatus("error");
      setStatusMessage("WebSocket connection error.");
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
        <button type="button" className="terminal-button back-btn" onClick={onBack}>
          Exit Game
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
