import { useEffect, useState } from "react";
import { getGameHistory } from "../api";
import TerminalSection from "../components/TerminalSection";
import { useSession } from "../context/session/useSession";
import { useTranslation } from "../context/language/i18n";
import type { GameHistoryItem } from "../types";

export default function GameHistoryPage() {
  const { sessionUser } = useSession();
  const { t } = useTranslation();
  const [history, setHistory] = useState<GameHistoryItem[]>([]);
  const [loading, setLoading] = useState(() => Boolean(sessionUser));
  const [error, setError] = useState("");

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

  const getResultBadge = (item: GameHistoryItem) => {
    if (item.winner_id === null) {
      return <span style={{ color: "yellow", fontWeight: "bold" }}>[{t("DRAW")}]</span>;
    }
    if (item.winner_id === sessionUser.id) {
      return <span style={{ color: "#00ff00", fontWeight: "bold" }}>[{t("WIN")}]</span>;
    }
    return <span style={{ color: "#ff4444", fontWeight: "bold" }}>[{t("LOSS")}]</span>;
  };

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
