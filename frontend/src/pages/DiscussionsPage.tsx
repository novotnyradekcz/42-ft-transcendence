import TerminalSection from "../components/TerminalSection";
import WriteStatus from "../components/WriteStatus";
import { useData } from "../context/DataContext";
import { useTerminal } from "../context/TerminalContext";

export default function DiscussionsPage() {
  const { discussions } = useData();
  const { writeFlow, writeError } = useTerminal();

  return (
    <TerminalSection title="Discussions">
      <ol className="terminal-list numbered">
        {discussions.map((discussion) => (
          <li key={discussion.id}>
            <span>{discussion.name}</span>
            <small>
              {discussion.nPosts} posts / {discussion.info}
            </small>
          </li>
        ))}
      </ol>
      {writeFlow?.mode === "new-discussion" && (
        <WriteStatus
          error={writeError}
          text={`Writing new discussion. Current prompt: ${writeFlow.step}.`}
        />
      )}
    </TerminalSection>
  );
}
