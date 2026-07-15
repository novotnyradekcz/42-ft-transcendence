import TerminalSection from "../components/TerminalSection";
import { useTerminal } from "../context/terminal/useTerminal";
import { useTranslation } from "../context/language/i18n";

export default function RegisterPage() {
  const { authFlow, authError } = useTerminal();
  const { t } = useTranslation();

  return (
    <TerminalSection title={t("Register")}>
      <p className="terminal-copy">
        {t("Register happens in the command input. Current prompt: {step}.", {
          step: authFlow?.mode === "register" ? authFlow.step : t("idle"),
        })}
      </p>
      <p className="terminal-copy">
        {t("Registration sends name, email, and password to `/users/create`.")}
      </p>
      <p className="terminal-copy">{t("Press Ctrl+C or Esc to quit register.")}</p>
      {authError && <p className="terminal-error">{authError}</p>}
    </TerminalSection>
  );
}
