// Plays one match: an uploaded Lua game, run in the browser by wasmoon, against
// an opponent matched over a websocket.
//
// The screen is a 40x20 character grid. The script draws into it by calling the
// functions handed to it below, and the two players' scripts talk to each other
// by passing strings through the server.
//
// The script is untrusted — anyone with an account can upload one — so
// everything it hands back is bounded before it reaches the DOM: coordinates
// clamped to the grid, strings truncated, colours checked against a pattern,
// and outgoing frames length-capped. It also gets its own wasm heap, which has
// to be closed by hand on every path that ends the game.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuaFactory, type LuaEngine } from "wasmoon";
import { useSession } from "../context/session/useSession";
import { useTranslation } from "../context/language/i18n";
import { PAGE_PATHS } from "../router";
import type { GameSummary } from "../types";
import { useWebSocket } from "../hooks/useWebSocket";

// the playfield, in characters. the lua side addresses it 1-based
const GRID_COLS = 40;
const GRID_ROWS = 20;
// ceiling on what one send_message() call may put on the wire
const MAX_PAYLOAD_LEN = 2000;
// colours go straight into a style attribute, so only names, hex and rgb-ish
// lists get through — anything else falls back to green rather than being
// passed along
const SAFE_COLOR_REGEX = /^[a-zA-Z0-9#,-]+$/;

// a blank playfield. also what a script's clear_screen() gets
const createEmptyGrid = () =>
  Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => ({
      char: " ",
      color: "green",
    })),
  );

// flattens the grid into the single array the dom renders
const flattenGrid = (rows: Cell[][]): Cell[] => {
  const flat: Cell[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      flat.push({ ...rows[r][c] });
    }
  }
  return flat;
};

// one character on the grid
type Cell = {
  char: string;
  color: string;
};

// frames the server sends over /games/play/ws
type GameServerMessage =
  | { type: "match_waiting" }
  | {
      type: "match_start";
      opponent_name: string;
      player_index: number;
      script: string;
    }
  | { type: "game_action"; data: string }
  | { type: "opponent_disconnected" };

export default function GamePlayPage({ game }: { game: GameSummary | null }) {
  const { sessionUser } = useSession();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [grid, setGrid] = useState<Cell[]>(() => flattenGrid(createEmptyGrid()));

  // reset during render instead of in an effect, so the dom is never touched twice
  const [renderedGameId, setRenderedGameId] = useState(game?.id);
  if (game?.id !== renderedGameId) {
    setRenderedGameId(game?.id);
    setGrid(flattenGrid(createEmptyGrid()));
  }

  // connecting -> waiting -> playing, or off to disconnected/error from any of
  // them. what the status bar says, and whether clicks reach the script
  const [status, setStatus] = useState<
    "connecting" | "waiting" | "playing" | "disconnected" | "error"
  >("connecting");
  const [statusMessage, setStatusMessage] = useState(t("Connecting to server..."));

  const luaEngineRef = useRef<LuaEngine | null>(null);
  // the grid the Lua callbacks write into. a ref, not state: a script can draw
  // hundreds of cells per frame, and each one triggering a render would make
  // the game unplayable. forceUpdate() publishes the ref once per frame instead.
  const gridRef = useRef<Cell[][]>(createEmptyGrid());
  // status and t are read from inside long-lived socket callbacks, which close
  // over the render that created them — the refs give them the current values
  const statusRef = useRef(status);
  const tRef = useRef(t);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const forceUpdate = () => {
    setGrid(flattenGrid(gridRef.current));
  };

  // wasmoon holds wasm memory outside the GC's reach, so an engine that isn't
  // closed leaks. every path that ends a game — error, disconnect, unmount, or
  // a new match_start — goes through here.
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

  // clicks are the only input a game gets. a script that throws here loses its
  // engine rather than being left half-running
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
      console.error("Error in Lua on_click handler:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setStatus("error");
      setStatusMessage(tRef.current("Game script runtime error: {msg}", { msg }));
      cleanupLua();
    }
  };

  const queryParams: Record<string, string | number> = game && sessionUser
    ? { game_id: game.id, user_id: sessionUser.id }
    : {};

  const { sendMessage } = useWebSocket<GameServerMessage>(
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

            // the four functions a game script is given. draw_cell is where
            // the untrusted values arrive, so it's where they get bounded
            lua.global.set(
              "draw_cell",
              (x: unknown, y: unknown, text: unknown, color: unknown) => {
                const posX = Number(x);
                const posY = Number(y);
                if (Number.isNaN(posX) || Number.isNaN(posY)) return;

                const r = Math.floor(posY) - 1;
                const cStart = Math.floor(posX) - 1;

                if (r >= 0 && r < GRID_ROWS) {
                  const rawStr = String(text ?? " ");
                  const str = rawStr.length > 40 ? rawStr.slice(0, 40) : rawStr;
                  const colorStr = String(color ?? "green");
                  const safeColor = SAFE_COLOR_REGEX.test(colorStr) ? colorStr : "green";

                  for (let i = 0; i < str.length; i++) {
                    const c = cStart + i;
                    if (c >= 0 && c < GRID_COLS) {
                      gridRef.current[r][c] = {
                        char: str[i],
                        color: safeColor,
                      };
                    }
                  }
                }
              },
            );

            lua.global.set("clear_screen", () => {
              gridRef.current = createEmptyGrid();
            });

            // the script's only way to reach the other player
            lua.global.set("send_message", (payload: unknown) => {
              const str = String(payload ?? "");
              if (str.length > MAX_PAYLOAD_LEN) return;
              sendMessage({ type: "game_action", data: str });
            });

            // which side this browser is playing, so one script can be both
            lua.global.set("player_index", msg.player_index);

            try {
              await lua.doString(msg.script);
              forceUpdate();
            } catch (evalErr) {
              console.error("Error executing game script:", evalErr);
              const scriptError = evalErr instanceof Error ? evalErr.message : String(evalErr);
              setStatus("error");
              setStatusMessage(
                tRef.current("Game script failed to run: {error}", { error: scriptError }),
              );
              cleanupLua();
            }
          } else if (msg.type === "game_action") {
            if (luaEngineRef.current) {
              const onNetworkMessage =
                luaEngineRef.current.global.get("on_network_message");
              if (onNetworkMessage) {
                try {
                  await onNetworkMessage(msg.data);
                  forceUpdate();
                } catch (netErr) {
                  console.error("Error in Lua on_network_message handler:", netErr);
                  const msgErr = netErr instanceof Error ? netErr.message : String(netErr);
                  setStatus("error");
                  setStatusMessage(
                    tRef.current("Game script network error: {msg}", { msg: msgErr }),
                  );
                  cleanupLua();
                }
              }
            }
          } else if (msg.type === "opponent_disconnected") {
            setStatus("disconnected");
            setStatusMessage(tRef.current("Opponent disconnected. Game ended."));
            cleanupLua();
          }
        } catch (err) {
          console.error("Error in onMessage handler:", err);
          setStatus("error");
          setStatusMessage(tRef.current("Unexpected error processing game message."));
          cleanupLua();
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

  // derived from props, not state
  const missingContext = !game || !sessionUser;

  useEffect(() => {
    if (missingContext) return;

    // keeps the ref the lua callbacks draw into in step with the reset above
    gridRef.current = createEmptyGrid();

    return () => {
      cleanupLua();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, sessionUser]);

  return (
    <div className="game-play-container">
      <div className="game-status-bar">
        <span className="game-title">{game?.name}</span>
        <span className="game-msg">
          {missingContext
            ? t("Game or session details missing.")
            : statusMessage}
        </span>
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
