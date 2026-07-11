import TerminalSection from "../components/TerminalSection";
import WriteStatus from "../components/WriteStatus";
import { useData } from "../context/DataContext";
import { useTerminal } from "../context/TerminalContext";
import { useTranslation } from "../i18n";

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
