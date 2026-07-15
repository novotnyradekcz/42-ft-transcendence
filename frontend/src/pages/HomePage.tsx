import TerminalSection from "../components/TerminalSection";
import { useSession } from "../context/session/useSession";
import { useTranslation } from "../context/language/i18n";

export default function HomePage() {
  const { sessionUser } = useSession();
  const { t } = useTranslation();

  return (
    <TerminalSection title={t("Main Menu")}>
      <p className="terminal-copy">
        {t("Welcome {name}. Choose a board section with commands.", {
          name: sessionUser?.name ?? t("guest"),
        })}
      </p>
      <ol className="terminal-list">
        <li>{t("discussions - public posts and replies")}</li>
        <li>{t("users - board member list")}</li>
        <li>{t("friends - saved users and online status")}</li>
        <li>{t("mail - non-live personal messages")}</li>
        <li>{t("games - empty for now")}</li>
        <li>
          {sessionUser
            ? t("logout - end this session")
            : t("login / register - account access")}
        </li>
      </ol>
    </TerminalSection>
  );
}
