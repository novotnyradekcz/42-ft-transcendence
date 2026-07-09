import TerminalSection from "../components/TerminalSection";
import { useTerminal } from "../context/TerminalContext";

export default function RegisterPage() {
  const { authFlow, authError } = useTerminal();

  return (
    <TerminalSection title="Register">
      <p className="terminal-copy">
        Register happens in the command input. Current prompt:{" "}
        {authFlow?.mode === "register" ? authFlow.step : "idle"}.
      </p>
      <p className="terminal-copy">
        Registration sends name, email, and password to `/users/create`.
      </p>
      <p className="terminal-copy">Press Ctrl+C or Esc to quit register.</p>
      {authError && <p className="terminal-error">{authError}</p>}
    </TerminalSection>
  );
}
