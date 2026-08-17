import { useEffect, useState } from "react";
import { getLeaderboard } from "../api";
import TerminalSection from "../components/TerminalSection";
import { useTranslation } from "../context/language/i18n";
import type { LeaderboardItem } from "../types";

export default function GameLeaderboardPage() {
  const { t } = useTranslation();
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getLeaderboard()
      .then((data) => {
        setLeaderboard(data);
        setError("");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t("Could not load leaderboard."));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [t]);

  return (
    <TerminalSection title={t("Top 10 Players Leaderboard")}>
      {loading ? (
        <p className="terminal-copy">{t("Loading leaderboard...")}</p>
      ) : error ? (
        <p className="terminal-error">{error}</p>
      ) : leaderboard.length === 0 ? (
        <p className="terminal-copy">{t("No leaderboard data available.")}</p>
      ) : (
        <ol className="terminal-list numbered">
          {leaderboard.map((item) => (
            <li key={item.user_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontWeight: "bold", color: "#00ffff", marginRight: "0.5rem" }}>
                  #{item.rank}
                </span>
                <strong>{item.user_name}</strong>
              </div>
              <div>
                <small style={{ marginRight: "1rem" }}>
                  {item.wins}W / {item.losses}L / {item.draws}D
                </small>
                <span style={{ color: "#ffff00", fontWeight: "bold" }}>
                  Ratio: {item.win_loss_ratio.toFixed(2)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </TerminalSection>
  );
}
