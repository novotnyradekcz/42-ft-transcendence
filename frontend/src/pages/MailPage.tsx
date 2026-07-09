import TerminalSection from "../components/TerminalSection";
import WriteStatus from "../components/WriteStatus";
import { useData } from "../context/DataContext";
import { useSession } from "../context/SessionContext";
import { useTerminal } from "../context/TerminalContext";

export default function MailPage() {
  const { mail } = useData();
  const { sessionUser, knownUsers } = useSession();
  const { writeFlow, writeError } = useTerminal();

  const userName = (id: number) =>
    knownUsers.find((u) => u.id === id)?.name ?? `user#${id}`;

  return (
    <TerminalSection title="Personal Mail">
      {mail.length === 0 ? (
        <p className="terminal-copy">
          No mail available. Log in to view your inbox.
        </p>
      ) : (
        <ol className="terminal-list numbered">
          {mail.map((message) => (
            <li key={message.id}>
              <span>{message.title}</span>
              <small>
                {message.sender === sessionUser?.id
                  ? `sent to ${userName(message.recipient)}`
                  : `from ${userName(message.sender)}`}
              </small>
            </li>
          ))}
        </ol>
      )}
      {writeFlow?.mode === "mail" && (
        <WriteStatus
          error={writeError}
          text={`Writing mail. Current prompt: ${writeFlow.step}.`}
        />
      )}
    </TerminalSection>
  );
}
