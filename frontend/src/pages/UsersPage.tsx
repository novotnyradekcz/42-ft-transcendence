import AvatarImage from "../components/AvatarImage";
import TerminalSection from "../components/TerminalSection";
import { useSession } from "../context/SessionContext";

export default function UsersPage() {
  const { knownUsers, sessionUser } = useSession();
  const friendIds = new Set(sessionUser?.friends ?? []);

  return (
    <TerminalSection title="Users">
      {knownUsers.length === 0 ? (
        <p className="terminal-copy">No users available.</p>
      ) : (
        <ol className="terminal-list numbered user-list">
          {knownUsers.map((user) => (
            <li key={user.id}>
              <AvatarImage user={user} />
              <span>{user.name}</span>
              <small>
                {user.email} / {user.status}
                {friendIds.has(user.id) ? " / friend" : ""}
              </small>
            </li>
          ))}
        </ol>
      )}
    </TerminalSection>
  );
}
