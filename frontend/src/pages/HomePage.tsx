import TerminalSection from "../components/TerminalSection";
import { useSession } from "../context/SessionContext";

export default function HomePage() {
  const { sessionUser } = useSession();

  return (
    <TerminalSection title="Main Menu">
      <p className="terminal-copy">
        Welcome {sessionUser?.name ?? "guest"}. Choose a board section with commands.
      </p>
      <ol className="terminal-list">
        <li>discussions - public posts and replies</li>
        <li>users - board member list</li>
        <li>friends - saved users and online status</li>
        <li>mail - non-live personal messages</li>
        <li>games - empty for now</li>
        <li>
          {sessionUser
            ? "logout - end this session"
            : "login / register - account access"}
        </li>
      </ol>
    </TerminalSection>
  );
}
