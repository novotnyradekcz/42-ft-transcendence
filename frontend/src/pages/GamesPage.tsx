import TerminalSection from "../components/TerminalSection";
import { useData } from "../context/DataContext";
import { useSession } from "../context/SessionContext";

export default function GamesPage() {
  const { games } = useData();
  const { knownUsers } = useSession();

  const userName = (id: number) =>
    knownUsers.find((u) => u.id === id)?.name ?? `user#${id}`;

  return (
    <TerminalSection title="Games">
      {games.length === 0 ? (
        <p className="terminal-copy">No games installed yet.</p>
      ) : (
        <ol className="terminal-list numbered">
          {games.map((game) => (
            <li key={game.id}>
              <span>{game.name}</span>
              <small>by {userName(game.author)}</small>
            </li>
          ))}
        </ol>
      )}
    </TerminalSection>
  );
}
