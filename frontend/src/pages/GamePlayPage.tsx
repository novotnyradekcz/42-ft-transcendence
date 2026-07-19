import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { LuaFactory } from "wasmoon";
import { useSession } from "../context/SessionContext";
import { PAGE_PATHS } from "../router";
import type { GameSummary } from "../types";
import { useWebSocket } from "../hooks/useWebSocket";

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
  const [statusMessage, setStatusMessage] = useState("Connecting to server...");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const luaEngineRef = useRef<any>(null);
  const sendMessageRef = useRef<(data: string) => boolean>(() => false);
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
      Promise.resolve().then(() => {
        setStatus("error");
        setStatusMessage("Game or session details missing.");
      });
      return;
    }

    gridRef.current = createEmptyGrid();
    Promise.resolve().then(() => {
      forceUpdate();
    });

    return () => {
      cleanupLua();
    };
  }, [game, sessionUser]);

  const wsUrlPath = game && sessionUser
    ? `/games/play/ws?game_id=${game.id}&user_id=${sessionUser.id}`
    : "";

  const handleMessage = useCallback(async (data: string) => {
    try {
      const msg = JSON.parse(data);

      if (msg.type === "match_waiting") {
        setStatus("waiting");
        setStatusMessage("Waiting for an opponent to join...");
      } else if (msg.type === "match_start") {
        setStatus("playing");
        setStatusMessage(`Playing vs ${msg.opponent_name}`);

        cleanupLua();

        const factory = new LuaFactory("/glue.wasm");
        const lua = await factory.createEngine();

        // Sandbox isolation: remove dangerous Lua globals
        const unsafeGlobals = ["os", "io", "package", "require", "dofile", "loadfile", "debug"];
        for (const g of unsafeGlobals) {
          try {
            lua.global.set(g, undefined);
          } catch (err) {
            console.warn(`Could not undefine global ${g}:`, err);
          }
        }

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
          sendMessageRef.current(
            JSON.stringify({ type: "game_action", data: payload }),
          );
        });

        lua.global.set("player_index", msg.player_index);

        // Execute script
        let scriptContent = msg.script;
        if (msg.script.startsWith("/") || msg.script.startsWith("http")) {
          try {
            const resp = await fetch(msg.script);
            if (!resp.ok) {
              throw new Error(`Failed to fetch Lua script: ${resp.statusText}`);
            }
            scriptContent = await resp.text();
          } catch (fetchErr) {
            console.error(fetchErr);
            setStatus("error");
            setStatusMessage("Failed to load game script.");
            cleanupLua();
            return;
          }
        }
        await lua.doString(scriptContent);
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
        setStatusMessage("Opponent disconnected. Game ended.");
        cleanupLua();
      }
    } catch (err) {
      console.error("Error in onmessage:", err);
    }
  }, []);

  const { sendMessage } = useWebSocket(wsUrlPath, {
    onMessage: handleMessage,
    onOpen: () => {
      setStatus("connecting");
      setStatusMessage("Connected, searching for an opponent...");
    },
    onClose: () => {
      if (statusRef.current !== "disconnected") {
        setStatus("disconnected");
        setStatusMessage("Connection to server closed.");
      }
      cleanupLua();
    },
    onError: () => {
      setStatus("error");
      setStatusMessage("WebSocket connection error.");
      cleanupLua();
    },
  });

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

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
