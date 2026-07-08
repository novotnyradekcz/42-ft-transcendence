import { useState } from "react";
import { addFriend, removeFriend } from "../api";
import AvatarImage from "./AvatarImage";
import TerminalSection from "./TerminalSection";
import { useData } from "../context/DataContext";
import { useSession } from "../context/SessionContext";
import { useTerminal } from "../context/TerminalContext";

export default function UserDetail() {
  const { selectedUser: user } = useData();
  const { sessionUser, updateSessionUser, refreshUsers } = useSession();
  const { addLine } = useTerminal();
  const [busy, setBusy] = useState(false);

  if (!user) {
    return <TerminalSection title="User">No user selected.</TerminalSection>;
  }

  const isFriend = sessionUser?.friends.includes(user.id) ?? false;
  const canManageFriendship = Boolean(
    sessionUser && sessionUser.id !== user.id,
  );

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
        addLine(`removed ${user!.name} from friends.`);
      } else {
        await addFriend(sessionUser.id, user!.id);
        updateSessionUser({
          ...sessionUser,
          friends: [...new Set([...sessionUser.friends, user!.id])],
        });
        addLine(`added ${user!.name} as friend.`);
      }
      await refreshUsers().catch(() => {});
    } catch (e) {
      addLine(e instanceof Error ? e.message : "could not update friends.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <TerminalSection title={`User: ${user.name}`}>
      <div className="profile-layout">
        <AvatarImage user={user} size="large" />
        <div>
          <dl className="terminal-facts">
            <dt>ID</dt>
            <dd>{user.id}</dd>
            <dt>Name</dt>
            <dd>{user.name}</dd>
            <dt>Email</dt>
            <dd>{user.email}</dd>
            <dt>Status</dt>
            <dd>{user.status}</dd>
            <dt>Bio</dt>
            <dd>{user.bio}</dd>
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
                {isFriend ? "remove friend" : "add friend"}
              </button>
            </div>
          )}
        </div>
      </div>
    </TerminalSection>
  );
}
