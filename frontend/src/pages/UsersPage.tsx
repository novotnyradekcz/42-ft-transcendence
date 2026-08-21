// Everyone on the board, as the numbered list `enter` and `addfriend` index into.

import AvatarImage from "../components/AvatarImage";
import TerminalSection from "../components/TerminalSection";
import { useStatus } from "../context/status/useStatus";
import { useSession } from "../context/session/useSession";
import { useTranslation } from "../context/language/i18n";

// rendered in knownUsers order and nothing else — the printed numbers have to
// line up with the same array the commands index into, see helpMenu.ts
export default function UsersPage() {
  const { knownUsers, sessionUser } = useSession();
  // online state comes from the status socket, not from user.status: the latter
  // is whatever was true when the list was fetched and goes stale immediately
  const { statusOf } = useStatus();
  const { t } = useTranslation();
  // rebuilt each render on purpose — a board-sized friend list is a handful of
  // ids, and memoising it would only add a dependency to keep correct
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
