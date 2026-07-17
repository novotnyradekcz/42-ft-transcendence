import { commandDefinitions } from "../commands";
import TerminalSection from "../components/TerminalSection";
import { useSession } from "../context/SessionContext";

export default function HelpPage() {
  const { sessionUser } = useSession();
  const isLoggedIn = Boolean(sessionUser);

  const visibleCommands = commandDefinitions.filter((command) => {
    if (isLoggedIn) {
      return command.command !== "login" && command.command !== "register";
    }
    return command.command !== "logout";
  });

  return (
    <TerminalSection title="Help">
      <div className="command-grid">
        {visibleCommands.map((command) => (
          <div key={command.command} className="command-row">
            <code>{command.usage}</code>
            <span>{command.description}</span>
            <small>
              {command.aliases.length ? `aliases: ${command.aliases.join(", ")}` : ""}
            </small>
          </div>
        ))}
      </div>
    </TerminalSection>
  );
}
