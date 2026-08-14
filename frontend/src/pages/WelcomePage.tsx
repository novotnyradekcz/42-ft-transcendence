import TerminalSection from "../components/TerminalSection";
import { useSession } from "../context/session/useSession";
import { useTranslation } from "../context/language/i18n";

export default function WelcomePage() {
  const { sessionUser } = useSession();
  const { t } = useTranslation();

  return (
    <TerminalSection title={t("Welcome")}>
      <pre className="welcome-logo" aria-label="42 ft_transcendence">
{String.raw`   _  _   ____
  | || | |___ \
  | || |_  __) |
  |__   _|/ __/
     |_| |_____|

FT_TRANSCENDENCE`}
      </pre>
      {sessionUser ? (
        <p className="terminal-copy">{t("Type `menu` to enter the board.")}</p>
      ) : (
        <>
          <p className="terminal-copy">
            {t("Members only. Sign in to enter the board.")}
          </p>
          <ol className="terminal-list">
            <li>
              <span>login</span> — {t("sign in to an existing account")}
            </li>
            <li>
              <span>register</span> — {t("create a new account")}
            </li>
          </ol>
        </>
      )}
    </TerminalSection>
  );
}
