import {
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createDiscussion,
  createPost,
  getApiRoutes,
  getCurrentUser,
  getDiscussion,
  getMail,
  getUser,
  getUserByUsername,
  listDiscussions,
  listGames,
  listMail,
  listUsers,
  login,
  logout,
  register,
  sendMail,
} from "./mock/mockApi";
import { commandDefinitions, getAvailableCommands, isCommand, parseCommand } from "./commands";
import type {
  ApiRoute,
  DiscussionThread,
  GameSummary,
  MailMessage,
  Page,
  SessionUser,
  UserProfile,
} from "./types";

type AuthFlow =
  | null
  | {
      mode: "login";
      step: "username" | "password";
      username: string;
    }
  | {
      mode: "register";
      step: "username" | "email" | "password";
      username: string;
      email: string;
    };

type WriteFlow =
  | null
  | {
      mode: "new-discussion";
      step: "title" | "body";
      title: string;
    }
  | {
      mode: "reply";
      discussionId: number;
    }
  | {
      mode: "mail";
      step: "recipient" | "body";
      recipient: string;
    };

const pagePaths: Record<Page, string> = {
  welcome: "/",
  home: "/menu",
  help: "/api/help",
  users: "/api/users",
  "user-detail": "/api/users",
  login: "/api/auth/login",
  register: "/api/auth/register",
  profile: "/api/me",
  discussions: "/api/discussions",
  "discussion-detail": "/api/discussions",
  mail: "/api/mail",
  "mail-detail": "/api/mail",
  games: "/api/games",
  api: "/api/routes",
};

function pageFromPath(pathname: string): Page {
  if (pathname === "/" || pathname === "") {
    return "welcome";
  }

  if (pathname === "/menu") {
    return "home";
  }

  if (pathname.startsWith("/api/users")) {
    return "users";
  }

  if (pathname.startsWith("/api/discussions")) {
    return "discussions";
  }

  if (pathname.startsWith("/api/mail")) {
    return "mail";
  }

  if (pathname === "/api/games") {
    return "games";
  }

  if (pathname === "/api/help") {
    return "help";
  }

  if (pathname === "/api/me") {
    return "profile";
  }

  if (pathname === "/api/auth/login") {
    return "login";
  }

  if (pathname === "/api/auth/register") {
    return "register";
  }

  if (pathname === "/api/routes") {
    return "api";
  }

  return "welcome";
}

export default function App() {
  const [page, setPage] = useState<Page>(() => pageFromPath(window.location.pathname));
  const commandInputRef = useRef<HTMLInputElement>(null);
  const [, setPageStack] = useState<Page[]>([]);
  const [commandInput, setCommandInput] = useState("");
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "ft_transcendence BBS ready.",
    "Type `menu` to enter.",
  ]);

  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [discussions, setDiscussions] = useState<DiscussionThread[]>([]);
  const [selectedDiscussion, setSelectedDiscussion] = useState<DiscussionThread | null>(null);
  const [mail, setMail] = useState<MailMessage[]>([]);
  const [selectedMail, setSelectedMail] = useState<MailMessage | null>(null);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [apiRoutes, setApiRoutes] = useState<ApiRoute[]>([]);

  const [authFlow, setAuthFlow] = useState<AuthFlow>(() => {
    const initialPage = pageFromPath(window.location.pathname);

    if (initialPage === "login") {
      return { mode: "login", step: "username", username: "" };
    }

    if (initialPage === "register") {
      return { mode: "register", step: "username", username: "", email: "" };
    }

    return null;
  });
  const [authError, setAuthError] = useState("");
  const [writeError, setWriteError] = useState("");
  const [writeFlow, setWriteFlow] = useState<WriteFlow>(null);

  const availableCommands = useMemo(
    () => getAvailableCommands(page, Boolean(sessionUser)),
    [page, sessionUser],
  );

  useEffect(() => {
    refreshBoard();
  }, []);

  useEffect(() => {
    commandInputRef.current?.focus();
  }, [page, authFlow, writeFlow]);

  useEffect(() => {
    function handlePopState() {
      const nextPage = pageFromPath(window.location.pathname);
      setPage(nextPage);
      if (nextPage === "login") {
        setAuthFlow({ mode: "login", step: "username", username: "" });
      } else if (nextPage === "register") {
        setAuthFlow({ mode: "register", step: "username", username: "", email: "" });
      } else {
        setAuthFlow(null);
      }
      clearWriteModes();
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  async function refreshBoard() {
    const [currentUser, nextUsers, nextDiscussions, nextMail, nextGames, nextRoutes] =
      await Promise.all([
        getCurrentUser(),
        listUsers(),
        listDiscussions(),
        listMail(),
        listGames(),
        getApiRoutes(),
      ]);

    setSessionUser(currentUser);
    setUsers(nextUsers);
    setDiscussions(nextDiscussions);
    setMail(nextMail);
    setGames(nextGames);
    setApiRoutes(nextRoutes);
  }

  function navigate(nextPage: Page, path = pagePaths[nextPage]) {
    if (nextPage !== page) {
      setPageStack((stack) => [...stack, page]);
    }
    clearWriteModes();
    setPage(nextPage);
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path);
    }
  }

  function goBack() {
    clearWriteModes();
    setPageStack((stack) => {
      const previousPage = stack.at(-1) ?? "home";
      setPage(previousPage);
      window.history.pushState(null, "", pagePaths[previousPage]);
      return stack.slice(0, -1);
    });
  }

  function clearWriteModes() {
    setWriteFlow(null);
    setWriteError("");
  }

  function addLine(line: string) {
    setTerminalLines((lines) => [...lines.slice(-8), line]);
  }

  async function refreshCurrentPage() {
    await refreshBoard();
    addLine(`refreshed ${page}.`);
  }

  async function handleCommandSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const rawInput = commandInput.trim();
    if (!rawInput) {
      return;
    }

    setCommandInput("");

    if (authFlow) {
      await handleAuthFlowInput(rawInput);
      return;
    }

    if (writeFlow) {
      await handleWriteFlowInput(rawInput);
      return;
    }

    addLine(`> ${rawInput}`);

    const { name, args } = parseCommand(rawInput);
    const definition = commandDefinitions.find((command) => isCommand(name, command));
    const command = definition?.command;

    if (!command) {
      addLine(`unknown command: ${name}`);
      return;
    }

    if (page === "welcome" && command !== "menu") {
      addLine("type `menu` to enter.");
      return;
    }

    if (command === "help") {
      navigate("help");
      return;
    }

    if (command === "menu") {
      clearWriteModes();
      setPageStack([]);
      setPage("home");
      window.history.pushState(null, "", pagePaths.home);
      return;
    }

    if (command === "back") {
      goBack();
      return;
    }

    if (command === "list") {
      await refreshCurrentPage();
      return;
    }

    if (command === "logout") {
      await logout();
      await refreshBoard();
      setPage("home");
      window.history.pushState(null, "", pagePaths.home);
      addLine("logged out.");
      return;
    }

    if (command === "write") {
      handleWriteCommand();
      return;
    }

    if (command === "enter") {
      await handleEnterCommand(args[0]);
      return;
    }

    if (command === "login") {
      if (sessionUser) {
        addLine("already logged in. use logout first.");
        return;
      }
      setAuthFlow({ mode: "login", step: "username", username: "" });
      setAuthError("");
      navigate("login");
      addLine("login started. enter username.");
      return;
    }

    if (command === "register") {
      if (sessionUser) {
        addLine("already logged in. use logout first.");
        return;
      }
      setAuthFlow({ mode: "register", step: "username", username: "", email: "" });
      setAuthError("");
      navigate("register");
      addLine("register started. enter username.");
      return;
    }

    const directPages: Partial<Record<string, Page>> = {
      users: "users",
      profile: "profile",
      discussions: "discussions",
      mail: "mail",
      games: "games",
      api: "api",
    };

    const nextPage = directPages[command];
    if (nextPage === "profile" && !sessionUser) {
      addLine("login first to view your profile.");
      setAuthFlow({ mode: "login", step: "username", username: "" });
      setAuthError("");
      navigate("login");
      return;
    }

    if (nextPage) {
      await refreshBoard();
      navigate(nextPage);
    }
  }

  async function handleAuthFlowInput(rawInput: string) {
    if (!authFlow) {
      return;
    }

    if (authFlow.mode === "login") {
      if (authFlow.step === "username") {
        setAuthFlow({ ...authFlow, step: "password", username: rawInput });
        addLine("username accepted. enter password.");
        return;
      }

      try {
        const nextUser = await login(authFlow.username, rawInput);
        setSessionUser(nextUser);
        setAuthFlow(null);
        setAuthError("");
        await refreshBoard();
        setPage("home");
        setPageStack([]);
        window.history.pushState(null, "", pagePaths.home);
        addLine(`logged in as ${nextUser.username}.`);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Login failed.");
        addLine("login failed. press Ctrl+C or Esc to quit, or enter username again.");
        setAuthFlow({ mode: "login", step: "username", username: "" });
      }
      return;
    }

    if (authFlow.step === "username") {
      setAuthFlow({ ...authFlow, step: "email", username: rawInput });
      addLine("username accepted. enter email.");
      return;
    }

    if (authFlow.step === "email") {
      setAuthFlow({ ...authFlow, step: "password", email: rawInput });
      addLine("email accepted. enter password.");
      return;
    }

    try {
      const nextUser = await register(authFlow.username, authFlow.email, rawInput);
      setSessionUser(nextUser);
      setAuthFlow(null);
      setAuthError("");
      await refreshBoard();
      setPage("home");
      setPageStack([]);
      window.history.pushState(null, "", pagePaths.home);
      addLine(`registered and logged in as ${nextUser.username}.`);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Registration failed.");
      addLine("registration failed. press Ctrl+C or Esc to quit, or enter username again.");
      setAuthFlow({ mode: "register", step: "username", username: "", email: "" });
    }
  }

  async function handleWriteFlowInput(rawInput: string) {
    if (!writeFlow) {
      return;
    }

    if (writeFlow.mode === "mail") {
      if (writeFlow.step === "recipient") {
        const recipient = await getUserByUsername(rawInput);

        if (!recipient) {
          setWriteError("Recipient username does not exist.");
          addLine("recipient not found. enter another username, or press Ctrl+C/Esc.");
          return;
        }

        setWriteError("");
        setWriteFlow({ mode: "mail", step: "body", recipient: recipient.username });
        addLine(`recipient accepted: ${recipient.username}. enter message.`);
        return;
      }

      try {
        await sendMail(writeFlow.recipient, rawInput);
        setWriteFlow(null);
        setWriteError("");
        await refreshBoard();
        addLine(`mail sent to ${writeFlow.recipient}.`);
      } catch (error) {
        setWriteError(error instanceof Error ? error.message : "Could not send mail.");
        addLine("mail failed. press Ctrl+C/Esc to quit, or enter message again.");
      }
      return;
    }

    if (writeFlow.mode === "new-discussion") {
      if (writeFlow.step === "title") {
        setWriteFlow({ mode: "new-discussion", step: "body", title: rawInput });
        addLine("title accepted. enter first post.");
        return;
      }

      try {
        const discussion = await createDiscussion(writeFlow.title, rawInput);
        setSelectedDiscussion(discussion);
        setWriteFlow(null);
        setWriteError("");
        await refreshBoard();
        navigate("discussion-detail", `/api/discussions/${discussion.id}`);
        addLine("discussion posted.");
      } catch (error) {
        setWriteError(error instanceof Error ? error.message : "Could not write discussion.");
        addLine("discussion failed. press Ctrl+C/Esc to quit, or enter post again.");
      }
      return;
    }

    try {
      const discussion = await createPost(writeFlow.discussionId, rawInput);
      setSelectedDiscussion(discussion);
      setWriteFlow(null);
      setWriteError("");
      await refreshBoard();
      addLine("reply posted.");
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : "Could not post reply.");
      addLine("reply failed. press Ctrl+C/Esc to quit, or enter reply again.");
    }
  }

  async function handleEnterCommand(indexValue?: string) {
    const index = Number(indexValue) - 1;

    if (!indexValue || Number.isNaN(index) || index < 0) {
      addLine("usage: enter <number>");
      return;
    }

    if (page === "users") {
      const user = users[index];
      if (!user) {
        addLine("no user exists at that number.");
        return;
      }
      setSelectedUser(await getUser(user.id));
      navigate("user-detail", `/api/users/${user.id}`);
      return;
    }

    if (page === "discussions") {
      const discussion = discussions[index];
      if (!discussion) {
        addLine("no discussion exists at that number.");
        return;
      }
      setSelectedDiscussion(await getDiscussion(discussion.id));
      navigate("discussion-detail", `/api/discussions/${discussion.id}`);
      return;
    }

    if (page === "mail") {
      const message = mail[index];
      if (!message) {
        addLine("no mail exists at that number.");
        return;
      }
      setSelectedMail(await getMail(message.id));
      navigate("mail-detail", `/api/mail/${message.id}`);
      return;
    }

    addLine("enter is not available on this page.");
  }

  function handleWriteCommand() {
    if (!sessionUser) {
      addLine("login first to write.");
      setAuthFlow({ mode: "login", step: "username", username: "" });
      setAuthError("");
      navigate("login");
      return;
    }

    if (page === "discussions") {
      setWriteFlow({ mode: "new-discussion", step: "title", title: "" });
      setWriteError("");
      addLine("new discussion. enter title.");
      return;
    }

    if (page === "discussion-detail") {
      if (!selectedDiscussion) {
        addLine("no discussion selected.");
        return;
      }
      setWriteFlow({ mode: "reply", discussionId: selectedDiscussion.id });
      setWriteError("");
      addLine("enter reply.");
      return;
    }

    if (page === "mail") {
      setWriteFlow({ mode: "mail", step: "recipient", recipient: "" });
      setWriteError("");
      addLine("enter recipient username.");
      return;
    }

    addLine("write is not available on this page.");
  }

  function handleCommandKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.ctrlKey && event.key.toLowerCase() === "c") {
      event.preventDefault();
      addLine("^C");
      cancelInputMode();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      addLine("Esc");
      cancelInputMode();
    }
  }

  function cancelInputMode() {
    if (authFlow) {
      setAuthFlow(null);
      setAuthError("");
      setCommandInput("");
      setPage("home");
      window.history.pushState(null, "", pagePaths.home);
      addLine("login/register cancelled.");
      return;
    }

    if (writeFlow) {
      setWriteFlow(null);
      setWriteError("");
      setCommandInput("");
      addLine("write cancelled.");
      return;
    }

    goBack();
  }

  function handleTerminalClick(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;

    if (target.closest("input, textarea, label")) {
      return;
    }

    commandInputRef.current?.focus();
  }

  return (
    <main className="terminal-page" onClick={handleTerminalClick}>
      <section className="terminal-window" aria-label="ft_transcendence terminal">
        <header className="terminal-header">
          <pre className="bbs-banner" aria-label="ft_transcendence banner">
{String.raw`+--------------------------------------------------+
|              FT_TRANSCENDENCE BBS               |
+--------------------------------------------------+`}
          </pre>
          <p className="terminal-kicker">bbs://ft_transcendence</p>
          <p className="terminal-session">
            {page === "welcome"
              ? "connection waiting"
              : `connected as ${sessionUser ? sessionUser.username : "guest"}`}
          </p>
        </header>

        <section className="terminal-output" aria-live="polite">
          {terminalLines.map((line, index) => (
            <p key={`${line}-${index}`}>{line}</p>
          ))}
        </section>

        <section className="terminal-body">
          {page === "welcome" && <WelcomePage />}
          {page === "home" && <HomePage sessionUser={sessionUser} />}
          {page === "help" && <HelpPage isLoggedIn={Boolean(sessionUser)} />}
          {page === "users" && <UsersPage users={users} />}
          {page === "user-detail" && <UserDetailPage user={selectedUser} />}
          {page === "login" && <LoginPage flow={authFlow} error={authError} />}
          {page === "register" && <RegisterPage flow={authFlow} error={authError} />}
          {page === "profile" && (
            <ProfilePage sessionUser={sessionUser} />
          )}
          {page === "discussions" && (
            <DiscussionsPage
              discussions={discussions}
              error={writeError}
              writeFlow={writeFlow}
            />
          )}
          {page === "discussion-detail" && (
            <DiscussionDetailPage
              discussion={selectedDiscussion}
              error={writeError}
              writeFlow={writeFlow}
            />
          )}
          {page === "mail" && (
            <MailPage
              mail={mail}
              error={writeError}
              sessionUser={sessionUser}
              writeFlow={writeFlow}
            />
          )}
          {page === "mail-detail" && <MailDetailPage message={selectedMail} />}
          {page === "games" && <GamesPage games={games} />}
          {page === "api" && <ApiPage routes={apiRoutes} />}
        </section>

        <footer className="terminal-footer">
          <pre className="ascii-rule" aria-hidden="true">
----------------------------------------------------
          </pre>
          <p>
            available:{" "}
            <span>{availableCommands.join(" | ")}</span>
          </p>
          <form onSubmit={handleCommandSubmit} className="command-form">
            <label htmlFor="command-input">{getPromptLabel(authFlow, writeFlow, sessionUser)}</label>
            <input
              id="command-input"
              value={commandInput}
              ref={commandInputRef}
              onChange={(event) => setCommandInput(event.target.value)}
              onKeyDown={handleCommandKeyDown}
              autoComplete="off"
              autoFocus
            />
          </form>
        </footer>
      </section>
    </main>
  );
}

function getPromptLabel(
  authFlow: AuthFlow,
  writeFlow: WriteFlow,
  sessionUser: SessionUser | null,
) {
  if (authFlow?.mode === "login") {
    return `login/${authFlow.step}:`;
  }

  if (authFlow?.mode === "register") {
    return `register/${authFlow.step}:`;
  }

  if (writeFlow?.mode === "mail") {
    return `mail/${writeFlow.step}:`;
  }

  if (writeFlow?.mode === "new-discussion") {
    return `discussion/${writeFlow.step}:`;
  }

  if (writeFlow?.mode === "reply") {
    return "reply/body:";
  }

  if (!sessionUser) {
    return "guest@ft_transcendence:$";
  }

  return `${sessionUser?.username ?? "guest"}@ft_transcendence:$`;
}

function WelcomePage() {
  return (
    <TerminalSection title="Welcome">
      <pre className="welcome-logo" aria-label="42 ft_transcendence">
{String.raw`   _  _   ____
  | || | |___ \
  | || |_  __) |
  |__   _|/ __/
     |_| |_____|

FT_TRANSCENDENCE`}
      </pre>
      <p className="terminal-copy">Type `menu` to enter the board.</p>
    </TerminalSection>
  );
}

function HomePage({ sessionUser }: { sessionUser: SessionUser | null }) {
  return (
    <TerminalSection title="Main Menu">
      <p className="terminal-copy">
        Welcome {sessionUser?.username ?? "guest"}. Choose a board section with commands.
      </p>
      <ol className="terminal-list">
        <li>discussions - public posts and replies</li>
        <li>users - board member list</li>
        <li>mail - non-live personal messages</li>
        <li>games - empty for now</li>
        <li>{sessionUser ? "logout - end this session" : "login / register - account access"}</li>
      </ol>
    </TerminalSection>
  );
}

function HelpPage({ isLoggedIn }: { isLoggedIn: boolean }) {
  const visibleCommands = commandDefinitions.filter((command) => {
    if (isLoggedIn) {
      return command.command !== "login" && command.command !== "register";
    }

    return command.command !== "logout";
  });

  return (
    <TerminalSection title="Help">
      <div className="command-grid">
        {visibleCommands.map((command) => (
          <div key={command.command} className="command-row">
            <code>{command.usage}</code>
            <span>{command.description}</span>
            <small>{command.aliases.length ? `aliases: ${command.aliases.join(", ")}` : ""}</small>
          </div>
        ))}
      </div>
    </TerminalSection>
  );
}

function UsersPage({ users }: { users: UserProfile[] }) {
  return (
    <TerminalSection title="Users">
      <ol className="terminal-list numbered">
        {users.map((user) => (
          <li key={user.id}>
            <span>{user.username}</span>
            <small>{user.status} / {user.email}</small>
          </li>
        ))}
      </ol>
    </TerminalSection>
  );
}

function UserDetailPage({ user }: { user: UserProfile | null }) {
  if (!user) {
    return <TerminalSection title="User">No user selected.</TerminalSection>;
  }

  return (
    <TerminalSection title={`User: ${user.username}`}>
      <dl className="terminal-facts">
        <dt>Email</dt>
        <dd>{user.email}</dd>
        <dt>Status</dt>
        <dd>{user.status}</dd>
        <dt>Bio</dt>
        <dd>{user.bio}</dd>
      </dl>
    </TerminalSection>
  );
}

function LoginPage({ flow, error }: { flow: AuthFlow; error: string }) {
  return (
    <TerminalSection title="Login">
      <p className="terminal-copy">
        Login happens in the command input. Current prompt: {flow?.mode === "login" ? flow.step : "idle"}.
      </p>
      <p className="terminal-copy">Press Ctrl+C or Esc to quit login.</p>
      {error && <p className="terminal-error">{error}</p>}
    </TerminalSection>
  );
}

function RegisterPage({ flow, error }: { flow: AuthFlow; error: string }) {
  return (
    <TerminalSection title="Register">
      <p className="terminal-copy">
        Register happens in the command input. Current prompt:{" "}
        {flow?.mode === "register" ? flow.step : "idle"}.
      </p>
      <p className="terminal-copy">Registration saves this user in the mock registeredUsers list.</p>
      <p className="terminal-copy">Press Ctrl+C or Esc to quit register.</p>
      {error && <p className="terminal-error">{error}</p>}
    </TerminalSection>
  );
}

function ProfilePage({
  sessionUser,
}: {
  sessionUser: SessionUser | null;
}) {
  if (!sessionUser) {
    return <TerminalSection title="Profile">Not logged in.</TerminalSection>;
  }

  return (
    <TerminalSection title="Profile">
      <dl className="terminal-facts">
        <dt>Username</dt>
        <dd>{sessionUser.username}</dd>
        <dt>Email</dt>
        <dd>{sessionUser.email}</dd>
      </dl>
    </TerminalSection>
  );
}

function DiscussionsPage({
  discussions,
  error,
  writeFlow,
}: {
  discussions: DiscussionThread[];
  error: string;
  writeFlow: WriteFlow;
}) {
  return (
    <TerminalSection title="Discussions">
      <ol className="terminal-list numbered">
        {discussions.map((discussion) => (
          <li key={discussion.id}>
            <span>{discussion.title}</span>
            <small>
              by {discussion.author} / {discussion.posts.length} posts / {discussion.createdAt}
            </small>
          </li>
        ))}
      </ol>
      {writeFlow?.mode === "new-discussion" && (
        <WriteStatus
          error={error}
          text={`Writing new discussion. Current prompt: ${writeFlow.step}.`}
        />
      )}
    </TerminalSection>
  );
}

function DiscussionDetailPage({
  discussion,
  error,
  writeFlow,
}: {
  discussion: DiscussionThread | null;
  error: string;
  writeFlow: WriteFlow;
}) {
  if (!discussion) {
    return <TerminalSection title="Discussion">No discussion selected.</TerminalSection>;
  }

  return (
    <TerminalSection title={discussion.title}>
      <div className="post-list">
        {discussion.posts.map((post) => (
          <article key={post.id}>
            <header>{post.author} / {post.createdAt}</header>
            <p>{post.body}</p>
          </article>
        ))}
      </div>
      {writeFlow?.mode === "reply" && (
        <WriteStatus error={error} text="Writing reply. Enter the reply in the command line." />
      )}
    </TerminalSection>
  );
}

function MailPage({
  mail,
  error,
  sessionUser,
  writeFlow,
}: {
  mail: MailMessage[];
  error: string;
  sessionUser: SessionUser | null;
  writeFlow: WriteFlow;
}) {
  return (
    <TerminalSection title="Personal Mail">
      {mail.length === 0 ? (
        <p className="terminal-copy">No mail available. Log in to view your inbox.</p>
      ) : (
        <ol className="terminal-list numbered">
          {mail.map((message) => (
            <li key={message.id}>
              <span>{message.body}</span>
              <small>
                {message.from === sessionUser?.username
                  ? `sent to ${message.to}`
                  : `from ${message.from}`}{" "}
                / {message.createdAt}
              </small>
            </li>
          ))}
        </ol>
      )}
      {writeFlow?.mode === "mail" && (
        <WriteStatus
          error={error}
          text={`Writing mail. Current prompt: ${writeFlow.step}.`}
        />
      )}
    </TerminalSection>
  );
}

function MailDetailPage({ message }: { message: MailMessage | null }) {
  if (!message) {
    return <TerminalSection title="Mail">No message selected.</TerminalSection>;
  }

  return (
    <TerminalSection title="Mail">
      <dl className="terminal-facts">
        <dt>From</dt>
        <dd>{message.from}</dd>
        <dt>To</dt>
        <dd>{message.to}</dd>
        <dt>Date</dt>
        <dd>{message.createdAt}</dd>
      </dl>
      <p className="terminal-copy">{message.body}</p>
    </TerminalSection>
  );
}

function GamesPage({ games }: { games: GameSummary[] }) {
  return (
    <TerminalSection title="Games">
      {games.length === 0 ? (
        <p className="terminal-copy">No games installed yet.</p>
      ) : (
        <ol className="terminal-list numbered">
          {games.map((game) => (
            <li key={game.id}>
              <span>{game.name}</span>
              <small>{game.status}</small>
            </li>
          ))}
        </ol>
      )}
    </TerminalSection>
  );
}

function ApiPage({ routes }: { routes: ApiRoute[] }) {
  return (
    <TerminalSection title="Mock API Routes">
      <div className="api-list">
        {routes.map((route) => (
          <div key={`${route.method}-${route.path}`}>
            <code>{route.method}</code>
            <span>{route.path}</span>
            <small>{route.description}</small>
          </div>
        ))}
      </div>
    </TerminalSection>
  );
}

function TerminalSection({
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

function WriteStatus({ error, text }: { error: string; text: string }) {
  return (
    <div className="write-status">
      <p className="terminal-copy">{text}</p>
      <p className="terminal-copy">Press Ctrl+C or Esc to cancel.</p>
      {error && <p className="terminal-error">{error}</p>}
    </div>
  );
}
