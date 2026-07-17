import AvatarImage from "../components/AvatarImage";
import TerminalSection from "../components/TerminalSection";
import { useSession } from "../context/SessionContext";

export default function FriendsPage() {
  const { sessionUser, knownUsers } = useSession();
  const friendIds = sessionUser?.friends ?? [];
  const friends = knownUsers.filter((u) => friendIds.includes(u.id));

  return (
    <TerminalSection title="Friends">
      {friends.length === 0 ? (
        <p className="terminal-copy">No friends added yet.</p>
      ) : (
        <ol className="terminal-list numbered user-list">
          {friends.map((friend) => (
            <li key={friend.id}>
              <AvatarImage user={friend} />
              <span>{friend.name}</span>
              <small>
                {friend.email} / {friend.status}
              </small>
            </li>
          ))}
        </ol>
      )}
    </TerminalSection>
  );
}
