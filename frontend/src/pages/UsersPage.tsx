import AvatarImage from "../components/AvatarImage";
import TerminalSection from "../components/TerminalSection";
import { useStatus } from "../context/status/useStatus";
import { useSession } from "../context/session/useSession";
import { useTranslation } from "../context/language/i18n";

export default function UsersPage() {
  const { knownUsers, sessionUser } = useSession();
  const { statusOf } = useStatus();
  const { t } = useTranslation();
  const friendIds = new Set(sessionUser?.friends ?? []);

  return (
    <TerminalSection title={t("Users")}>
      {knownUsers.length === 0 ? (
        <p className="terminal-copy">{t("No users available.")}</p>
      ) : (
        <ol className="terminal-list numbered user-list">
          {knownUsers.map((user) => (
            <li key={user.id}>
              <AvatarImage user={user} />
              <span>{user.name}</span>
              <small>
                {user.email} / {t(statusOf(user.id))}
                {friendIds.has(user.id) ? ` / ${t("friend")}` : ""}
              </small>
            </li>
          ))}
        </ol>
      )}
    </TerminalSection>
  );
}
