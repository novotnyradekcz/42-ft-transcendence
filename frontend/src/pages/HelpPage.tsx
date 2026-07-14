import { commandDefinitions } from "../commands";
import TerminalSection from "../components/TerminalSection";
import { useSession } from "../context/session/useSession";
import { useTranslation } from "../context/language/i18n";

export default function HelpPage() {
  const { sessionUser } = useSession();
  const { t } = useTranslation();
  const isLoggedIn = Boolean(sessionUser);

  const visibleCommands = commandDefinitions.filter((command) => {
    if (isLoggedIn) {
      return command.command !== "login" && command.command !== "register";
    }
    return command.command !== "logout";
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
