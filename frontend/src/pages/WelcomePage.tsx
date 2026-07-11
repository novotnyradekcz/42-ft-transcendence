import TerminalSection from "../components/TerminalSection";
import { useTranslation } from "../i18n";

export default function WelcomePage() {
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
      <p className="terminal-copy">{t("Type `menu` to enter the board.")}</p>
    </TerminalSection>
  );
}
