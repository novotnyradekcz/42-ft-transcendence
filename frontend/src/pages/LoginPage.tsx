import AuthPrompt from "../components/AuthPrompt";
import TerminalSection from "../components/TerminalSection";
import { useTerminal } from "../context/terminal/useTerminal";
import { useTranslation } from "../context/language/i18n";

export default function LoginPage() {
  const { authFlow, authError } = useTerminal();
  const { t } = useTranslation();
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
