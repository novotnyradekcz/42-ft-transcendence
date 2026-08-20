import { useEffect, useState } from "react";
import { getAchievements } from "../api";
import TerminalSection from "../components/TerminalSection";
import { useTranslation } from "../context/language/i18n";
import type { UserAchievement } from "../types";

export default function GameAchievementsPage() {
  const { t } = useTranslation();
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAchievements()
      .then((data) => {
        setAchievements(data);
        setError("");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t("Could not load achievements."));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [t]);

  return (
    <TerminalSection title={t("Game Achievements")}>
      {loading ? (
        <p className="terminal-copy">{t("Loading achievements...")}</p>
      ) : error ? (
        <p className="terminal-error">{error}</p>
      ) : achievements.length === 0 ? (
        <p className="terminal-copy">{t("No achievements available.")}</p>
      ) : (
        <ol className="terminal-list">
          {achievements.map((item) => (
            <li
              key={item.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                opacity: item.unlocked ? 1 : 0.4,
                filter: item.unlocked ? "none" : "grayscale(80%)",
                padding: "0.4rem 0",
                borderBottom: "1px dashed rgba(255, 255, 255, 0.15)",
              }}
            >
              <div>
                <span style={{ fontSize: "1.2rem", marginRight: "0.5rem" }}>
                  {item.emoji}
                </span>
                <strong style={{ color: item.unlocked ? "#ffff00" : "inherit" }}>
                  {item.name}
                </strong>
                <span style={{ marginLeft: "0.75rem", fontSize: "0.9rem" }}>
                  {item.description}
                </span>
              </div>
              <div>
                {item.unlocked ? (
                  <span style={{ color: "#00ff00", fontSize: "0.85rem", fontWeight: "bold" }}>
                    ✓ {t("Unlocked")} ({item.unlocked_at})
                  </span>
                ) : (
                  <span style={{ fontSize: "0.85rem", fontStyle: "italic" }}>
                    🔒 {t("Locked")}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </TerminalSection>
  );
}
