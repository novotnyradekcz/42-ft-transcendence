// The top ten players, by win/loss ratio.
//
// A server-side aggregate over every game played, not one of the board
// collections — so it's fetched here rather than through DataContext, and the
// rows arrive with their user names already joined in.

import { useEffect, useState } from "react";
import { getLeaderboard } from "../api";
import TerminalSection from "../components/TerminalSection";
import { useTranslation } from "../context/language/i18n";
import type { LeaderboardItem } from "../types";

export default function GameLeaderboardPage() {
  const { t } = useTranslation();
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  // starts true: unlike the history page this loads for everyone, so the
  // request is always on its way by first paint
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // t is a dependency only because it supplies the fallback message; changing
  // language therefore refetches, which is harmless and keeps the deps honest
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
                <strong>{item.user_name}</strong>
                {item.latest_achievements && item.latest_achievements.length > 0 && (
                  <span style={{ marginLeft: "0.5rem" }} title={t("Latest achievements")}>
                    {item.latest_achievements.join(" ")}
                  </span>
                )}
              </div>
              <div>
                <small style={{ marginRight: "1rem" }}>
                  {item.wins}W / {item.losses}L / {item.draws}D
                </small>
                <span style={{ color: "#ffff00", fontWeight: "bold" }}>
                  {t("Win rate")}: {item.win_loss_ratio.toFixed(4)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </TerminalSection>
  );
}
