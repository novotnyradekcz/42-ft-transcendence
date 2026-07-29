import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { createGame } from "../api";
import TerminalSection from "../components/TerminalSection";
import { useData } from "../context/data/useData";
import { useSession } from "../context/session/useSession";
import { useTerminal } from "../context/terminal/useTerminal";
import { useTranslation } from "../context/language/i18n";

export default function GamesPage() {
  const { games, refreshBoard } = useData();
  const { sessionUser, knownUsers } = useSession();
  const { addLine } = useTerminal();
  const { t } = useTranslation();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const userName = (id: number) =>
    knownUsers.find((u) => u.id === id)?.name ?? `user#${id}`;

  const triggerUpload = () => {
    if (!sessionUser) {
      const msg = t("login first to upload games.");
      setErrorMsg(msg);
      addLine(msg);
      return;
    }
    fileInputRef.current?.click();
  };

  useEffect(() => {
    const handleTrigger = () => {
      triggerUpload();
    };
    window.addEventListener("trigger-game-upload", handleTrigger);
    return () => window.removeEventListener("trigger-game-upload", handleTrigger);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser]);

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

      await createGame(name, body, sessionUser.id);
      await refreshBoard();

      const successStr = t("uploaded game '{name}'.", { name });
      setStatusMsg(successStr);
      addLine(successStr);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("could not upload game.");
      setErrorMsg(msg);
      addLine(msg);
    } finally {
      setUploading(false);
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
