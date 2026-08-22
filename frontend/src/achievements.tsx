import React from "react";
import { useTranslation } from "./context/language/i18n";

export type AchievementDefinition = {
  id: number;
  name: string;
  badge: React.ReactNode;
};

export const ACHIEVEMENTS: Record<number, AchievementDefinition> = {
  1: {
    id: 1,
    name: "Started a game",
    badge: (
      <svg
        className="achievement-badge"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="6" width="20" height="12" rx="6" />
        <circle cx="8" cy="12" r="1.5" fill="currentColor" />
        <circle cx="16" cy="10" r="1" fill="currentColor" />
        <circle cx="18" cy="13" r="1" fill="currentColor" />
        <path d="M6 12h4M8 10v4" />
      </svg>
    ),
  },
  2: {
    id: 2,
    name: "Finished a game",
    badge: (
      <svg
        className="achievement-badge"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="currentColor" fillOpacity="0.2" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
    ),
  },
  3: {
    id: 3,
    name: "Won a game",
    badge: (
      <svg
        className="achievement-badge achievement-badge-gold"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="#FFD700"
        stroke="#DAA520"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" fill="none" />
        <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" fill="none" />
        <path d="M4 3h16v6a8 8 0 0 1-16 0V3z" />
        <path d="M12 17v4" fill="none" />
        <path d="M8 21h8" fill="none" />
      </svg>
    ),
  },
};

export function AchievementsList({
  achievementIds,
}: {
  achievementIds?: number[];
}) {
  const { t } = useTranslation();

  if (!achievementIds || achievementIds.length === 0) {
    return <span className="terminal-copy-dim">{t("No achievements unlocked yet.")}</span>;
  }

  const unlocked = achievementIds
    .map((id) => ACHIEVEMENTS[id])
    .filter((a): a is AchievementDefinition => Boolean(a));

  if (unlocked.length === 0) {
    return <span className="terminal-copy-dim">{t("No achievements unlocked yet.")}</span>;
  }

  return (
    <ul className="achievements-list">
      {unlocked.map((item) => (
        <li key={item.id} className="achievement-item">
          {item.badge}
          <span className="achievement-name">{t(item.name)}</span>
        </li>
      ))}
    </ul>
  );
}
