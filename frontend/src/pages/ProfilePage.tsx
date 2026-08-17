import { type ChangeEvent, type FormEvent, useState } from "react";
import { updateCurrentUserProfile } from "../api";
import { AVATAR_MAX_PX, avatarToData } from "../avatar";
import AvatarImage from "../components/AvatarImage";
import TerminalSection from "../components/TerminalSection";
import { useStatus } from "../context/status/useStatus";
import { useSession } from "../context/session/useSession";
import { useTerminal } from "../context/terminal/useTerminal";
import { useTranslation } from "../context/language/i18n";

type FormSubmitEvent = FormEvent<HTMLFormElement>;

export default function ProfilePage() {
  const { sessionUser, updateSessionUser, refreshUsers } = useSession();
  const { statusOf } = useStatus();
  const { addLine } = useTerminal();
  const { t } = useTranslation();

  // name and email are fixed at registration and only shown, never edited
  const [bio, setBio] = useState(sessionUser?.bio ?? "");
  // holds the picked image itself, not a link to one, and is what gets saved
  const [avatarUrl, setAvatarUrl] = useState(sessionUser?.avatarUrl ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!sessionUser) {
    return <TerminalSection title={t("Profile")}>{t("Not logged in.")}</TerminalSection>;
  }

  // reads and shrinks the picked file, but doesn't save it — the result sits
  // in the preview until the profile is submitted
  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // the input is cleared either way, so re-picking the same file re-fires
    event.target.value = "";
    if (!file) return;

    setMessage("");
    setError("");
    try {
      setAvatarUrl(await avatarToData(file));
      setMessage(t("avatar ready. save the profile to keep it."));
    } catch (caughtError) {
      const msg =
        caughtError instanceof Error
          ? t(caughtError.message)
          : t("could not read that image.");
      setError(msg);
      addLine(msg);
    }
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      const nextUser = await updateCurrentUserProfile(sessionUser!.id, {
        bio,
        avatarUrl: avatarUrl.trim(),
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

  return (
    <TerminalSection title={t("Profile")}>
      <div className="profile-layout">
        {/* shows the pending pick, so the crop and scale are visible before
            anything is saved */}
        <AvatarImage
          user={{ name: sessionUser.name, avatarUrl }}
          size="large"
        />
        <div>
          <dl className="terminal-facts">
            <dt>{t("Name")}</dt>
            <dd>{sessionUser.name}</dd>
            <dt>{t("Email")}</dt>
            <dd>{sessionUser.email}</dd>
            <dt>{t("Status")}</dt>
            <dd>{t(statusOf(sessionUser.id))}</dd>
            <dt>{t("Bio")}</dt>
            <dd>{sessionUser.bio}</dd>
          </dl>
          <form className="profile-form" onSubmit={handleSubmit}>
            {/* Name and email are listed above and stay there: they identify
                the account, so the form only edits what's cosmetic. */}
            <label>
              {t("Bio")}
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} />
            </label>
            <label>
              {t("Avatar")}
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => {
                  void handleAvatarChange(e);
                }}
              />
              {/* what the picker will accept, in place of the old URL box */}
              <small className="field-legend">
                {t(
                  "PNG or JPEG only, up to 500 KB. Larger pictures are scaled down to {size}x{size}.",
                  { size: AVATAR_MAX_PX },
                )}
              </small>
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
