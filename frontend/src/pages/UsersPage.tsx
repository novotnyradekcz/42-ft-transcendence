import AvatarImage from "../components/AvatarImage";
import TerminalSection from "../components/TerminalSection";
import { useSession } from "../context/SessionContext";
import { useTranslation } from "../i18n";

export default function UsersPage() {
  const { knownUsers, sessionUser } = useSession();
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
                {user.email} / {t(user.status)}
                {friendIds.has(user.id) ? ` / ${t("friend")}` : ""}
              </small>
            </li>
          ))}
        </ol>
      )}
    </TerminalSection>
  );
}
