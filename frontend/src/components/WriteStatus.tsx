// The banner a page shows while a write flow is running on it.
//
// Same job as AuthPrompt: the typing happens in the command line, so the page's
// only role is to say what's being asked for and how to get out of it.

import { useTranslation } from "../context/language/i18n";

export default function WriteStatus({
  error,
  text,
}: {
  error: string;
  text: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="write-status">
      <p className="terminal-copy">{text}</p>
      <p className="terminal-copy">{t("Press Ctrl+C or Esc to cancel.")}</p>
      {error && <p className="terminal-error">{error}</p>}
    </div>
  );
}
