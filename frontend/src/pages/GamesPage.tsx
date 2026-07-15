import TerminalSection from "../components/TerminalSection";
import { useData } from "../context/data/useData";
import { useSession } from "../context/session/useSession";
import { useTranslation } from "../context/language/i18n";

export default function GamesPage() {
  const { games } = useData();
  const { knownUsers } = useSession();
  const { t } = useTranslation();

  const userName = (id: number) =>
    knownUsers.find((u) => u.id === id)?.name ?? `user#${id}`;

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
    </TerminalSection>
  );
}
