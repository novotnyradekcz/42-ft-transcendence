import { type ChangeEvent, type FormEvent, useState } from "react";
import { updateCurrentUserProfile, uploadAvatar } from "../api";
import AvatarImage from "../components/AvatarImage";
import TerminalSection from "../components/TerminalSection";
import { useSession } from "../context/SessionContext";
import { useTerminal } from "../context/TerminalContext";
import { useTranslation } from "../i18n";

type FormSubmitEvent = FormEvent<HTMLFormElement>;

export default function ProfilePage() {
  const { sessionUser, updateSessionUser, refreshUsers } = useSession();
  const { addLine } = useTerminal();
  const { t } = useTranslation();

  const [name, setName] = useState(sessionUser?.name ?? "");
  const [email, setEmail] = useState(sessionUser?.email ?? "");
  const [bio, setBio] = useState(sessionUser?.bio ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!sessionUser) {
    return <TerminalSection title={t("Profile")}>{t("Not logged in.")}</TerminalSection>;
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
      addLine(t("profile updated."));
      setMessage(t("saved."));
    } catch (caughtError) {
      const msg =
        caughtError instanceof Error
          ? caughtError.message
          : t("could not save profile.");
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
      addLine(t("avatar uploaded."));
      setMessage(t("avatar saved."));
    } catch (caughtError) {
      const msg =
        caughtError instanceof Error
          ? caughtError.message
          : t("could not save avatar.");
      setError(msg);
      addLine(msg);
    } finally {
      event.target.value = "";
    }
  }

  return (
    <TerminalSection title={t("Profile")}>
      <div className="profile-layout">
        <AvatarImage user={sessionUser} size="large" />
        <div>
          <dl className="terminal-facts">
            <dt>{t("Name")}</dt>
            <dd>{sessionUser.name}</dd>
            <dt>{t("Email")}</dt>
            <dd>{sessionUser.email}</dd>
            <dt>{t("Status")}</dt>
            <dd>{t(sessionUser.status)}</dd>
            <dt>{t("Bio")}</dt>
            <dd>{sessionUser.bio}</dd>
          </dl>
          <form className="profile-form" onSubmit={handleSubmit}>
            <label>
              {t("Name")}
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              {t("Email")}
              <input value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              {t("Bio")}
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} />
            </label>
            <label>
              {t("Avatar")}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
              />
            </label>
            <button className="terminal-button" type="submit">
              {t("save profile")}
            </button>
          </form>
          {message && <p className="terminal-copy">{message}</p>}
          {error && <p className="terminal-error">{error}</p>}
        </div>
      </div>
    </TerminalSection>
  );
}
