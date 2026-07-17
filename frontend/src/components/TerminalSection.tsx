import type { ReactNode } from "react";

export default function TerminalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="terminal-section">
      <pre className="ascii-rule" aria-hidden="true">
----------------------------------------------------
      </pre>
      <h2>{`[ ${title} ]`}</h2>
      {children}
    </section>
  );
}
