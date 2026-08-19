import { useEffect, useState } from "react";
import TerminalSection from "../components/TerminalSection";
import { useSession } from "../context/session/useSession";
import { useTranslation } from "../context/language/i18n";
import { fetchOAuthProviders, oauthError, type OAuthProvider } from "../api";

export default function WelcomePage() {
  const { sessionUser } = useSession();
  const { t } = useTranslation();
  // shown here, not in the terminal log — guests can't run `log`, so anything
  // addLine writes is invisible to them
  const [providers, setProviders] = useState<OAuthProvider[]>([]);

  useEffect(() => {
    if (sessionUser) return;
    let cancelled = false;
    fetchOAuthProviders()
      .then((list) => {
        if (!cancelled) setProviders(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionUser]);

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
          {oauthError && <p className="terminal-error">{oauthError}</p>}
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
            {providers.map((provider) => (
              <li key={provider.id}>
                <span>oauth {provider.id}</span> —{" "}
                {t("sign in with {label}", { label: provider.label })}
              </li>
            ))}
          </ol>
        </>
      )}
    </TerminalSection>
  );
}
