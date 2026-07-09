import TerminalSection from "../components/TerminalSection";
import { useTerminal } from "../context/TerminalContext";

export default function LoginPage() {
  const { authFlow, authError } = useTerminal();

  return (
    <TerminalSection title="Login">
      <p className="terminal-copy">
        Login happens in the command input. Current prompt:{" "}
        {authFlow?.mode === "login" ? authFlow.step : "idle"}.
      </p>
      <p className="terminal-copy">Press Ctrl+C or Esc to quit login.</p>
      {authError && <p className="terminal-error">{authError}</p>}
    </TerminalSection>
  );
}
