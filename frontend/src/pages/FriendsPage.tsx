// The signed-in user's friends. The same rows as UsersPage, over a smaller list.

import AvatarImage from "../components/AvatarImage";
import TerminalSection from "../components/TerminalSection";
import { useData } from "../context/data/useData";
import { useStatus } from "../context/status/useStatus";
import { useTranslation } from "../context/language/i18n";

// its own numbering, so `enter 2` here and `enter 2` on the user list are
// different people — resolveFriendTarget() picks the list to match the page
export default function FriendsPage() {
  // derived once in DataProvider so the page and the `friends` command agree
  const { friends } = useData();
  // live from the status socket, so a friend going offline shows up without
  // refetching the user list
  const { statusOf } = useStatus();
  const { t } = useTranslation();

  return (
    <TerminalSection title={t("Friends")}>
      {friends.length === 0 ? (
        <p className="terminal-copy">{t("No friends added yet.")}</p>
      ) : (
        <ol className="terminal-list numbered user-list">
          {friends.map((friend) => (
            <li key={friend.id}>
              <AvatarImage user={friend} />
              <span>{friend.name}</span>
              <small>
                {friend.email} / {t(statusOf(friend.id))}
              </small>
            </li>
          ))}
        </ol>
      )}
    </TerminalSection>
  );
}
