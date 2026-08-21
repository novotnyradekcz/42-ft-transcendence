// The register screen. Same shape as LoginPage with an extra email step, and
// the password step is never echoed back.

import AuthPrompt from "../components/AuthPrompt";
import TerminalSection from "../components/TerminalSection";
import { useTerminal } from "../context/terminal/useTerminal";
import { useTranslation } from "../context/language/i18n";

export default function RegisterPage() {
  const { authFlow, authError } = useTerminal();
  const { t } = useTranslation();
  // narrowed by mode, so a login flow left in state can't drive this screen
  const flow = authFlow?.mode === "register" ? authFlow : null;

  return (
    <TerminalSection title={t("Register")}>
      <AuthPrompt
        current={flow?.step ?? null}
        error={authError}
        steps={[
          { key: "name", label: t("username"), value: flow?.name },
          { key: "email", label: t("email"), value: flow?.email },
          { key: "password", label: t("password") },
        ]}
      />
      <p className="terminal-copy">
        {t("Already have an account? Cancel, then type `login`.")}
      </p>
    </TerminalSection>
  );
}
