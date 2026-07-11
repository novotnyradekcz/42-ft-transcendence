import TerminalSection from "../components/TerminalSection";
import { useTerminal } from "../context/TerminalContext";
import { useTranslation } from "../i18n";

export default function LoginPage() {
  const { authFlow, authError } = useTerminal();
  const { t } = useTranslation();

  return (
    <TerminalSection title={t("Login")}>
      <p className="terminal-copy">
        {t("Login happens in the command input. Current prompt: {step}.", {
          step: authFlow?.mode === "login" ? authFlow.step : t("idle"),
        })}
      </p>
      <p className="terminal-copy">{t("Press Ctrl+C or Esc to quit login.")}</p>
      {authError && <p className="terminal-error">{authError}</p>}
    </TerminalSection>
  );
}
