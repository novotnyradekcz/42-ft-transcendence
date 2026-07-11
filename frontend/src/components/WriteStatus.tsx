import { useTranslation } from "../i18n";

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
