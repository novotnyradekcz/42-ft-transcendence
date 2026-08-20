// The login screen — a read-out, not a form. The answers are typed into the
// command line and TerminalProvider walks the flow; rendering this is what
// tells the user which step the prompt is on.

import AuthPrompt from "../components/AuthPrompt";
import TerminalSection from "../components/TerminalSection";
import { useTerminal } from "../context/terminal/useTerminal";
import { useTranslation } from "../context/language/i18n";

export default function LoginPage() {
  const { authFlow, authError } = useTerminal();
  const { t } = useTranslation();
  // narrowed by mode, so a register flow left in state can't drive this screen
  const flow = authFlow?.mode === "login" ? authFlow : null;

  return (
    <TerminalSection title={t("Login")}>
      <AuthPrompt
        current={flow?.step ?? null}
        error={authError}
        steps={[
          { key: "name", label: t("username"), value: flow?.name },
          { key: "password", label: t("password") },
        ]}
      />
      <p className="terminal-copy">
        {t("No account yet? Cancel, then type `register`.")}
      </p>
    </TerminalSection>
  );
}
