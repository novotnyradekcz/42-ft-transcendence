import TerminalSection from "../components/TerminalSection";
import WriteStatus from "../components/WriteStatus";
import { useData } from "../context/DataContext";
import { useSession } from "../context/SessionContext";
import { useTerminal } from "../context/TerminalContext";
import { useTranslation } from "../i18n";

export default function DiscussionDetailPage() {
  const { selectedDiscussion: discussion } = useData();
  const { knownUsers } = useSession();
  const { writeFlow, writeError } = useTerminal();
  const { t } = useTranslation();

  const userName = (id: number) =>
    knownUsers.find((u) => u.id === id)?.name ?? `user#${id}`;

  if (!discussion) {
    return (
      <TerminalSection title={t("Discussion")}>
        {t("No discussion selected.")}
      </TerminalSection>
    );
  }

  return (
    <TerminalSection title={discussion.name}>
      <p className="terminal-copy">{discussion.info}</p>
      <div className="post-list">
        {discussion.posts.map((post) => (
          <article key={post.id}>
            <header>
              {userName(post.author)} / {post.name}
            </header>
            <p>{post.body}</p>
          </article>
        ))}
      </div>
      {writeFlow?.mode === "reply" && (
        <WriteStatus
          error={writeError}
          text={t("Writing reply. Enter the reply in the command line.")}
        />
      )}
    </TerminalSection>
  );
}
