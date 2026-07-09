export default function WriteStatus({
  error,
  text,
}: {
  error: string;
  text: string;
}) {
  return (
    <div className="write-status">
      <p className="terminal-copy">{text}</p>
      <p className="terminal-copy">Press Ctrl+C or Esc to cancel.</p>
      {error && <p className="terminal-error">{error}</p>}
    </div>
  );
}
