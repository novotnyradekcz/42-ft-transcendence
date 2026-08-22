// Another user's profile, and the one action available on it: friend/unfriend.
// The same job the `addfriend` command does, as a button.

import { useState } from "react";
import { addFriend, removeFriend } from "../api";
import { AchievementsList } from "../achievements";
import AvatarImage from "./AvatarImage";
import TerminalSection from "./TerminalSection";
import { useData } from "../context/data/useData";
import { useStatus } from "../context/status/useStatus";
import { useSession } from "../context/session/useSession";
import { useTerminal } from "../context/terminal/useTerminal";
import { useTranslation } from "../context/language/i18n";

// rendered from the user `enter` selected, not from the :id in the URL, so a
// direct link or a reload lands on the empty state
export default function UserDetail() {
  const { selectedUser: user } = useData();
  const { sessionUser, updateSessionUser, refreshUsers } = useSession();
  const { statusOf } = useStatus();
  const { addLine } = useTerminal();
  const { t } = useTranslation();
  // blocks a second click while the first request is out
  const [busy, setBusy] = useState(false);

  if (!user) {
    return <TerminalSection title={t("User")}>{t("No user selected.")}</TerminalSection>;
  }

  const isFriend = sessionUser?.friends.includes(user.id) ?? false;
  // no button for guests, and none on your own profile
  const canManageFriendship = Boolean(
    sessionUser && sessionUser.id !== user.id,
  );

  // The session user's own friend list is updated from what was just sent
  // rather than from the response, because the friend endpoints answer with a
  // receipt and not a profile. refreshUsers() afterwards is for everyone else's
  // rows, and is allowed to fail — the local view is already correct.
  async function handleToggleFriend() {
    if (!sessionUser || busy) return;
    setBusy(true);
    try {
      if (isFriend) {
        await removeFriend(sessionUser.id, user!.id);
        updateSessionUser({
          ...sessionUser,
          friends: sessionUser.friends.filter((id) => id !== user!.id),
        });
        addLine(t("removed {name} from friends.", { name: user!.name }));
      } else {
        await addFriend(sessionUser.id, user!.id);
        updateSessionUser({
          ...sessionUser,
          friends: [...new Set([...sessionUser.friends, user!.id])],
        });
        addLine(t("added {name} as friend.", { name: user!.name }));
      }
      await refreshUsers().catch(() => {});
    } catch (e) {
      addLine(e instanceof Error ? e.message : t("could not update friends."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <TerminalSection title={t("User: {name}", { name: user.name })}>
      <div className="profile-layout">
        <AvatarImage user={user} size="large" />
        <div>
          <dl className="terminal-facts">
            <dt>{t("ID")}</dt>
            <dd>{user.id}</dd>
            <dt>{t("Name")}</dt>
            <dd>{user.name}</dd>
            <dt>{t("Email")}</dt>
            <dd>{user.email}</dd>
            <dt>{t("Status")}</dt>
            <dd>{t(statusOf(user.id))}</dd>
            <dt>{t("Bio")}</dt>
            <dd>{user.bio}</dd>
            <dt>{t("Achievements")}</dt>
            <dd>
              <AchievementsList achievementIds={user.achievements} />
            </dd>
          </dl>
          {canManageFriendship && (
            <div className="friend-actions">
              <button
                className="terminal-button"
                type="button"
                disabled={busy}
                onClick={() => {
                  void handleToggleFriend();
                }}
              >
                {isFriend ? t("remove friend") : t("add friend")}
              </button>
            </div>
          )}
        </div>
      </div>
    </TerminalSection>
  );
}
