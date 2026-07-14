import TerminalSection from "../components/TerminalSection";
import WriteStatus from "../components/WriteStatus";
import { useData } from "../context/data/useData";
import { useSession } from "../context/session/useSession";
import { useTerminal } from "../context/terminal/useTerminal";
import { useTranslation } from "../context/language/i18n";

export default function MailPage() {
  const { mail } = useData();
  const { sessionUser, knownUsers } = useSession();
  const { writeFlow, writeError } = useTerminal();
  const { t } = useTranslation();

  const userName = (id: number) =>
    knownUsers.find((u) => u.id === id)?.name ?? `user#${id}`;

  return (
    <TerminalSection title={t("Personal Mail")}>
      {mail.length === 0 ? (
        <p className="terminal-copy">
          {t("No mail available. Log in to view your inbox.")}
        </p>
      ) : (
        <ol className="terminal-list numbered">
          {mail.map((message) => (
            <li key={message.id}>
              <span>{message.title}</span>
              <small>
                {message.sender === sessionUser?.id
                  ? t("sent to {name}", { name: userName(message.recipient) })
                  : t("from {name}", { name: userName(message.sender) })}
              </small>
            </li>
          ))}
        </ol>
      )}
      {writeFlow?.mode === "mail" && (
        <WriteStatus
          error={writeError}
          text={t("Writing mail. Current prompt: {step}.", {
            step: writeFlow.step,
          })}
        />
      )}
    </TerminalSection>
  );
}
