// Your past matches, newest first.
//
// Win or loss is worked out here rather than sent by the server, because the
// rows are neutral — they name both players and the winner, and which of those
// is "you" depends on who is asking.

import { useEffect, useState } from "react";
import { getGameHistory } from "../api";
import TerminalSection from "../components/TerminalSection";
import { useSession } from "../context/session/useSession";
import { useTranslation } from "../context/language/i18n";
import type { GameHistoryItem } from "../types";

// fetches for itself instead of going through DataContext: /games/history is
// scoped to the caller's token and read nowhere else, and the rows carry their
// own player names, so no user list is needed
export default function GameHistoryPage() {
  const { sessionUser } = useSession();
  const { t } = useTranslation();
  const [history, setHistory] = useState<GameHistoryItem[]>([]);
  // starts false for guests: no request goes out for them, so a spinner would
  // never resolve
  const [loading, setLoading] = useState(() => Boolean(sessionUser));
  const [error, setError] = useState("");

  // guests never get here through the UI, but the check keeps a direct URL from
  // firing a request that would only 401
  useEffect(() => {
    if (!sessionUser) return;

    getGameHistory()
      .then((data) => {
        setHistory(data);
        setError("");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t("Could not load match history."));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sessionUser, t]);

  if (!sessionUser) {
    return (
      <TerminalSection title={t("Game History")}>
        <p className="terminal-copy">{t("login first to view your match history.")}</p>
      </TerminalSection>
    );
  }

  // win/loss is relative to whoever is signed in, so it's decided here rather
  // than sent by the server
  const getResultBadge = (item: GameHistoryItem) => {
    if (item.winner_id === null) {
      return <span style={{ color: "yellow", fontWeight: "bold" }}>[{t("DRAW")}]</span>;
    }
    if (item.winner_id === sessionUser.id) {
      return <span style={{ color: "#00ff00", fontWeight: "bold" }}>[{t("WIN")}]</span>;
    }
    return <span style={{ color: "#ff4444", fontWeight: "bold" }}>[{t("LOSS")}]</span>;
  };

  // the row names both players without saying which one is you
  const getOpponentName = (item: GameHistoryItem) => {
    if (item.player1_id === sessionUser.id) {
      return item.player2_name;
    }
    return item.player1_name;
  };

  return (
    <TerminalSection title={t("Your Match History")}>
      {loading ? (
        <p className="terminal-copy">{t("Loading match history...")}</p>
      ) : error ? (
        <p className="terminal-error">{error}</p>
      ) : history.length === 0 ? (
        <p className="terminal-copy">{t("No game history found.")}</p>
      ) : (
        <ol className="terminal-list numbered">
          {history.map((item) => (
            <li key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>{item.game_name}</strong>{" "}
                <small>vs {getOpponentName(item)}</small>
              </div>
              <div style={{ textAlign: "right" }}>
                {getResultBadge(item)}{" "}
                <small style={{ marginLeft: "0.5rem", opacity: 0.8 }}>{item.played_at}</small>
              </div>
            </li>
          ))}
        </ol>
      )}
    </TerminalSection>
  );
}
