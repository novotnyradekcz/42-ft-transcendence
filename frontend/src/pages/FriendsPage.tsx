import AvatarImage from "../components/AvatarImage";
import TerminalSection from "../components/TerminalSection";
import { useData } from "../context/data/useData";
import { useStatus } from "../context/status/useStatus";
import { useTranslation } from "../context/language/i18n";

export default function FriendsPage() {
  // derived once in DataProvider so the page and the `friends` command agree
  const { friends } = useData();
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
