import TerminalSection from "../components/TerminalSection";

export default function WelcomePage() {
  return (
    <TerminalSection title="Welcome">
      <pre className="welcome-logo" aria-label="42 ft_transcendence">
{String.raw`   _  _   ____
  | || | |___ \
  | || |_  __) |
  |__   _|/ __/
     |_| |_____|

FT_TRANSCENDENCE`}
      </pre>
      <p className="terminal-copy">Type `menu` to enter the board.</p>
    </TerminalSection>
  );
}
