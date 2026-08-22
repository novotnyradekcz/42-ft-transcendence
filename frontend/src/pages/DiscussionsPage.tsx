// The thread list. Bodies aren't fetched here — the server sends a post count
// instead — so a thread has to be opened to read it.

import TerminalSection from "../components/TerminalSection";
import WriteStatus from "../components/WriteStatus";
import { useData } from "../context/data/useData";
import { useTerminal } from "../context/terminal/useTerminal";
import { useTranslation } from "../context/language/i18n";

// the numbers are what `enter <n>` indexes into, so the render order has to
// stay the order DataContext holds
export default function DiscussionsPage() {
  const { discussions } = useData();
  const { writeFlow, writeError } = useTerminal();
  const { t } = useTranslation();

  return (
    <TerminalSection title={t("Discussions")}>
      <ol className="terminal-list numbered">
        {discussions.map((discussion) => (
          <li key={discussion.id}>
            <span>{discussion.name}</span>
            <small>
              {t("{count} posts", { count: discussion.nPosts })} / {discussion.info}
            </small>
          </li>
        ))}
      </ol>
      {writeFlow?.mode === "new-discussion" && (
        <WriteStatus
          error={writeError}
          text={t("Writing new discussion. Current prompt: {step}.", {
            step: writeFlow.step,
          })}
        />
      )}
    </TerminalSection>
  );
}
