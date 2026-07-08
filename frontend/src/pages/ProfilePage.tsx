import { type ChangeEvent, type FormEvent, useState } from "react";
import { updateCurrentUserProfile, uploadAvatar } from "../api";
import AvatarImage from "../components/AvatarImage";
import TerminalSection from "../components/TerminalSection";
import { useSession } from "../context/SessionContext";
import { useTerminal } from "../context/TerminalContext";

type FormSubmitEvent = FormEvent<HTMLFormElement>;

export default function ProfilePage() {
  const { sessionUser, updateSessionUser, refreshUsers } = useSession();
  const { addLine } = useTerminal();

  const [name, setName] = useState(sessionUser?.name ?? "");
  const [email, setEmail] = useState(sessionUser?.email ?? "");
  const [bio, setBio] = useState(sessionUser?.bio ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!sessionUser) {
    return <TerminalSection title="Profile">Not logged in.</TerminalSection>;
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      const nextUser = await updateCurrentUserProfile(sessionUser!.id, {
        name,
        email,
        bio,
      });
      updateSessionUser(nextUser);
      await refreshUsers().catch(() => {});
      addLine("profile updated.");
      setMessage("saved.");
    } catch (caughtError) {
      const msg =
        caughtError instanceof Error
          ? caughtError.message
          : "could not save profile.";
      setError(msg);
      addLine(msg);
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage("");
    setError("");
    try {
      const avatarUrl = await uploadAvatar(file);
      const nextUser = await updateCurrentUserProfile(sessionUser!.id, {
        name: sessionUser!.name,
        email: sessionUser!.email,
        bio: sessionUser!.bio,
        avatarUrl,
      });
      updateSessionUser(nextUser);
      await refreshUsers().catch(() => {});
      addLine("avatar uploaded.");
      setMessage("avatar saved.");
    } catch (caughtError) {
      const msg =
        caughtError instanceof Error
          ? caughtError.message
          : "could not save avatar.";
      setError(msg);
      addLine(msg);
    } finally {
      event.target.value = "";
    }
  }

  return (
    <TerminalSection title="Profile">
      <div className="profile-layout">
        <AvatarImage user={sessionUser} size="large" />
        <div>
          <dl className="terminal-facts">
            <dt>Name</dt>
            <dd>{sessionUser.name}</dd>
            <dt>Email</dt>
            <dd>{sessionUser.email}</dd>
            <dt>Status</dt>
            <dd>{sessionUser.status}</dd>
            <dt>Bio</dt>
            <dd>{sessionUser.bio}</dd>
          </dl>
          <form className="profile-form" onSubmit={handleSubmit}>
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              Bio
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} />
            </label>
            <label>
              Avatar
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
              />
            </label>
            <button className="terminal-button" type="submit">
              save profile
            </button>
          </form>
          {message && <p className="terminal-copy">{message}</p>}
          {error && <p className="terminal-error">{error}</p>}
        </div>
      </div>
    </TerminalSection>
  );
}
