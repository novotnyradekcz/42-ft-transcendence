import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuaFactory } from "wasmoon";
import { useSession } from "../context/session/useSession";
import { useTranslation } from "../context/language/i18n";
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

  const queryParams: Record<string, string | number> = game && sessionUser
    ? { game_id: game.id, user_id: sessionUser.id }
    : {};

  const { sendMessage } = useWebSocket(
    game && sessionUser ? "/games/play/ws" : null,
    queryParams,
    {
      onOpen: () => {
        setStatus("connecting");
        setStatusMessage(tRef.current("Connected, searching for an opponent..."));
      },
      onMessage: async (msg) => {
        try {
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
              sendMessage({ type: "game_action", data: payload });
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
          console.error("Error in onMessage handler:", err);
        }
      },
      onClose: () => {
        if (statusRef.current !== "disconnected") {
          setStatus("disconnected");
          setStatusMessage(tRef.current("Connection to server closed."));
        }
        cleanupLua();
      },
      onError: () => {
        setStatus("error");
        setStatusMessage(tRef.current("WebSocket connection error."));
        cleanupLua();
      },
    }
  );

  useEffect(() => {
    if (!game || !sessionUser) {
      setStatus("error");
      setStatusMessage(tRef.current("Game or session details missing."));
      return;
    }

    gridRef.current = createEmptyGrid();
    forceUpdate();

    return () => {
      cleanupLua();
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
