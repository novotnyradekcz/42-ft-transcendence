import AvatarImage from "../components/AvatarImage";
import TerminalSection from "../components/TerminalSection";
import { useSession } from "../context/SessionContext";
import { useTranslation } from "../i18n";

export default function FriendsPage() {
  const { sessionUser, knownUsers } = useSession();
  const { t } = useTranslation();
  const friendIds = sessionUser?.friends ?? [];
  const friends = knownUsers.filter((u) => friendIds.includes(u.id));

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
                {friend.email} / {t(friend.status)}
              </small>
            </li>
          ))}
        </ol>
      )}
    </TerminalSection>
  );
}
