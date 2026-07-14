import TerminalSection from "../components/TerminalSection";
import { useData } from "../context/data/useData";
import { useSession } from "../context/session/useSession";
import { useTranslation } from "../context/language/i18n";

export default function MailDetailPage() {
  const { selectedMail: message } = useData();
  const { knownUsers } = useSession();
  const { t } = useTranslation();

  const userName = (id: number) =>
    knownUsers.find((u) => u.id === id)?.name ?? `user#${id}`;

  if (!message) {
    return <TerminalSection title={t("Mail")}>{t("No message selected.")}</TerminalSection>;
  }

  return (
    <TerminalSection title={t("Mail")}>
      <dl className="terminal-facts">
        <dt>{t("From")}</dt>
        <dd>{userName(message.sender)}</dd>
        <dt>{t("To")}</dt>
        <dd>{userName(message.recipient)}</dd>
        <dt>{t("Title")}</dt>
        <dd>{message.title}</dd>
      </dl>
      <p className="terminal-copy">{message.body}</p>
    </TerminalSection>
  );
}
