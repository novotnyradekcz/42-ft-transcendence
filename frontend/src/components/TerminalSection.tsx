// The frame every board screen sits in: an ASCII rule, then a bracketed
// heading, then whatever the page renders. Pages use this instead of writing
// their own heading, which is what keeps them looking like one program.

import type { ReactNode } from "react";

// the rule is decoration, so it's hidden from screen readers rather than read
// out as fifty dashes before every section
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
