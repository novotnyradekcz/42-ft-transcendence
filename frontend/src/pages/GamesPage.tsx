// The installed games, and the control that uploads a new one.
//
// A game is a Lua script stored as text on the server and run in the browser by
// GamePlayPage, so "installing" one is just reading the .lua file and POSTing
// its contents — there is nothing to compile or unpack.

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { createGame } from "../api";
import TerminalSection from "../components/TerminalSection";
import { useData } from "../context/data/useData";
import { useSession } from "../context/session/useSession";
import { useTerminal } from "../context/terminal/useTerminal";
import { useTranslation } from "../context/language/i18n";

import { useNavigate } from "react-router-dom";
import { PAGE_PATHS } from "../router";

export default function GamesPage() {
  const { games, refreshForPage } = useData();
  const { sessionUser, knownUsers } = useSession();
  const { addLine } = useTerminal();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // games carry an author id, not a name
  const userName = (id: number) =>
    knownUsers.find((u) => u.id === id)?.name ?? `user#${id}`;

  // opens the file picker, from the button and from the `upload` command alike
  const triggerUpload = () => {
    if (!sessionUser) {
      const msg = t("login first to upload games.");
      setErrorMsg(msg);
      addLine(msg);
      return;
    }
    fileInputRef.current?.click();
  };

  // The `upload` command has to reach a file input, and a file picker only
  // opens from a real user gesture on the element itself — so the command
  // fires a window event and this page, which owns the input, answers it.
  // sessionUser is the only dependency that matters: triggerUpload closes over
  // it, and re-subscribing on every render would churn the listener.
  useEffect(() => {
    const handleTrigger = () => {
      triggerUpload();
    };
    window.addEventListener("trigger-game-upload", handleTrigger);
    return () => window.removeEventListener("trigger-game-upload", handleTrigger);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser]);

  // Checked again here even though triggerUpload() already did: the input can
  // also be reached by clicking it, and a session can end while the OS picker
  // is open.
  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!sessionUser) {
      const msg = t("login first to upload games.");
      setErrorMsg(msg);
      addLine(msg);
      return;
    }

    if (!file.name.toLowerCase().endsWith(".lua")) {
      const msg = t("Game must be a .lua file.");
      setErrorMsg(msg);
      addLine(msg);
      event.target.value = "";
      return;
    }

    setUploading(true);
    setStatusMsg("");
    setErrorMsg("");

    try {
      const body = await file.text();
      const name = file.name.replace(/\.lua$/i, "").trim() || "Untitled Game";

      await createGame(name, body);
      await refreshForPage("games");

      const successStr = t("uploaded game '{name}'.", { name });
      setStatusMsg(successStr);
      addLine(successStr);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("could not upload game.");
      setErrorMsg(msg);
      addLine(msg);
    } finally {
      setUploading(false);
      // cleared so picking the same file again still fires a change event
      event.target.value = "";
    }
  };

  return (
    <TerminalSection title={t("Games")}>
      {games.length === 0 ? (
        <p className="terminal-copy">{t("No games installed yet.")}</p>
      ) : (
        <ol className="terminal-list numbered">
          {games.map((game) => (
            <li key={game.id}>
              <span>{game.name}</span>
              <small>{t("by {name}", { name: userName(game.author) })}</small>
            </li>
          ))}
        </ol>
      )}

      <div style={{ marginTop: "1.5rem", paddingTop: "0.75rem", borderTop: "1px dashed #fff" }}>
        <p className="terminal-copy" style={{ marginBottom: "0.5rem" }}>
          {t("Enter `history` for match history, `leaderboard` for top players, or `achievements` for badges:")}
        </p>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          <button
            type="button"
            className="terminal-button"
            onClick={() => navigate(PAGE_PATHS["game-history"])}
          >
            {t("[ history ]")}
          </button>
          <button
            type="button"
            className="terminal-button"
            onClick={() => navigate(PAGE_PATHS["game-leaderboard"])}
          >
            {t("[ leaderboard ]")}
          </button>
          <button
            type="button"
            className="terminal-button"
            onClick={() => navigate(PAGE_PATHS["game-achievements"])}
          >
            {t("[ achievements ]")}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".lua"
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />
        <p className="terminal-copy" style={{ marginBottom: "0.5rem" }}>
          {t("Type `upload` or click below to install a new .lua game:")}
        </p>
        <button
          type="button"
          className="terminal-button"
          onClick={triggerUpload}
          disabled={uploading}
        >
          {uploading ? t("uploading...") : t("[ upload game (.lua) ]")}
        </button>
        {statusMsg && <p className="terminal-copy" style={{ marginTop: "0.5rem" }}>{statusMsg}</p>}
        {errorMsg && <p className="terminal-error" style={{ marginTop: "0.5rem" }}>{errorMsg}</p>}
      </div>
    </TerminalSection>
  );
}

