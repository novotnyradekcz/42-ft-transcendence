import TerminalSection from "../components/TerminalSection";
import { useData } from "../context/DataContext";
import { useSession } from "../context/SessionContext";

export default function MailDetailPage() {
  const { selectedMail: message } = useData();
  const { knownUsers } = useSession();

  const userName = (id: number) =>
    knownUsers.find((u) => u.id === id)?.name ?? `user#${id}`;

  if (!message) {
    return <TerminalSection title="Mail">No message selected.</TerminalSection>;
  }

  return (
    <TerminalSection title="Mail">
      <dl className="terminal-facts">
        <dt>From</dt>
        <dd>{userName(message.sender)}</dd>
        <dt>To</dt>
        <dd>{userName(message.recipient)}</dd>
        <dt>Title</dt>
        <dd>{message.title}</dd>
      </dl>
      <p className="terminal-copy">{message.body}</p>
    </TerminalSection>
  );
}
