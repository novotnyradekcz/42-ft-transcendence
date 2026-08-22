// The full command reference — every command, its aliases and its usage.
//
// The ? popover is the other half of this: it lists only what the current page
// accepts, while this lists everything. Both are filtered by session, so help
// never documents a command that would be refused.

import { commandDefinitions, isGuestCommand } from "../commands";
import TerminalSection from "../components/TerminalSection";
import { useSession } from "../context/session/useSession";
import { useTranslation } from "../context/language/i18n";

export default function HelpPage() {
  const { sessionUser } = useSession();
  const { t } = useTranslation();
  const isLoggedIn = Boolean(sessionUser);

  // mirrors the gate in executeCommand()
  const visibleCommands = commandDefinitions.filter((command) => {
    if (isLoggedIn) {
      return command.command !== "login" && command.command !== "register";
    }
    // guests only see what the gate lets through
    return isGuestCommand(command.command);
  });

  return (
    <TerminalSection title={t("Help")}>
      <div className="command-grid">
        {visibleCommands.map((command) => (
          <div key={command.command} className="command-row">
            <code>{command.usage}</code>
            <span>{t(command.description)}</span>
            <small>
              {command.aliases.length
                ? t("aliases: {aliases}", { aliases: command.aliases.join(", ") })
                : ""}
            </small>
          </div>
        ))}
      </div>
    </TerminalSection>
  );
}
