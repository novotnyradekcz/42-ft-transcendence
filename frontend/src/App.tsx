import {
  type ChangeEvent,
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
  DEFAULT_AVATAR_URL,
  addFriend,
  createDiscussion,
  createPost,
  findUserName,
  getCurrentUser,
  getDiscussion,
  getMail,
  getUser,
  getUserByName,
  listFriends,
  listDiscussions,
  listGames,
  listMail,
  listUsers,
  login,
  logout,
  register,
  removeFriend,
  sendMail,
  updateCurrentUserProfile,
  uploadAvatar,
} from "./api";
import { commandDefinitions, getAvailableCommands, isCommand, parseCommand } from "./commands";
import GamePlayPage from "./GamePlayPage";
import type {
  DiscussionThread,
  GameSummary,
  MailMessage,
  Page,
  SessionUser,
  UserProfile,
} from "./types";

type FormSubmitEvent = FormEvent<HTMLFormElement>;

type AuthFlow =
  | null
  | {
      mode: "login";
      step: "name" | "password";
      name: string;
    }
  | {
      mode: "register";
      step: "name" | "email" | "password";
      name: string;
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
      step: "recipient" | "title" | "body";
      recipient: string;
      title: string;
    };

const pagePaths: Record<Page, string> = {
  welcome: "/",
  home: "/menu",
  help: "/help",
  users: "/users/show",
  "user-detail": "/users/show",
  friends: "/friends/show",
  login: "/users/login",
  register: "/users/create",
  profile: "/users/me",
  discussions: "/discussions/show",
  "discussion-detail": "/discussions/show",
  mail: "/mail/show",
  "mail-detail": "/mail/show",
  games: "/games/show",
  "game-play": "/games/play",
};

function pageFromPath(pathname: string): Page {
  if (pathname === "/" || pathname === "") {
    return "welcome";
  }

  if (pathname === "/menu") {
    return "home";
  }

  if (pathname.startsWith("/users/show")) {
    return "users";
  }

  if (pathname.startsWith("/friends/show")) {
    return "friends";
  }

  if (pathname.startsWith("/discussions/show")) {
    return "discussions";
  }

  if (pathname.startsWith("/mail/show")) {
    return "mail";
  }

  if (pathname.startsWith("/games/play")) {
    return "game-play";
  }

  if (pathname === "/games/show") {
    return "games";
  }

  if (pathname === "/help") {
    return "help";
  }

  if (pathname === "/users/me") {
    return "profile";
  }

  if (pathname === "/users/login") {
    return "login";
  }

  if (pathname === "/users/create") {
    return "register";
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
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [discussions, setDiscussions] = useState<DiscussionThread[]>([]);
  const [selectedDiscussion, setSelectedDiscussion] = useState<DiscussionThread | null>(null);
  const [mail, setMail] = useState<MailMessage[]>([]);
  const [selectedMail, setSelectedMail] = useState<MailMessage | null>(null);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameSummary | null>(null);

  const [authFlow, setAuthFlow] = useState<AuthFlow>(() => {
    const initialPage = pageFromPath(window.location.pathname);

    if (initialPage === "login") {
      return { mode: "login", step: "name", name: "" };
    }

    if (initialPage === "register") {
      return { mode: "register", step: "name", name: "", email: "" };
    }

    return null;
  });
  const [authError, setAuthError] = useState("");
  const [writeError, setWriteError] = useState("");
  const [writeFlow, setWriteFlow] = useState<WriteFlow>(null);
  const [commandHelpOpen, setCommandHelpOpen] = useState(false);

  const availableCommands = useMemo(
    () => getAvailableCommands(page, Boolean(sessionUser)),
    [page, sessionUser],
  );
  const friendIds = useMemo(() => new Set(friends.map((friend) => friend.id)), [friends]);

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
        setAuthFlow({ mode: "login", step: "name", name: "" });
      } else if (nextPage === "register") {
        setAuthFlow({ mode: "register", step: "name", name: "", email: "" });
      } else {
        setAuthFlow(null);
      }
      clearWriteModes();
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  async function refreshBoard() {
    const [currentUser, nextUsers, nextFriends, nextDiscussions, nextMail, nextGames] =
      await Promise.all([
        getCurrentUser(),
        listUsers(),
        listFriends(),
        listDiscussions(),
        listMail(),
        listGames(),
      ]);

    setSessionUser(currentUser);
    setUsers(nextUsers);
    setFriends(nextFriends);
    setDiscussions(nextDiscussions);
    setMail(nextMail);
    setGames(nextGames);
    setSelectedUser((user) => {
      if (!user) {
        return user;
      }

      return (
        nextUsers.find((nextUser) => nextUser.id === user.id) ??
        nextFriends.find((nextUser) => nextUser.id === user.id) ??
        user
      );
    });
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

  async function handleCommandSubmit(event: FormSubmitEvent) {
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

    await executeCommand(rawInput);
  }

  async function executeCommand(rawInput: string, echo = true) {
    setCommandHelpOpen(false);

    if (echo) {
      addLine(`> ${rawInput}`);
    }

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

    if (command === "addfriend" || command === "removefriend") {
      await handleFriendCommand(command, args[0]);
      return;
    }

    if (command === "login") {
      if (sessionUser) {
        addLine("already logged in. use logout first.");
        return;
      }
      setAuthFlow({ mode: "login", step: "name", name: "" });
      setAuthError("");
      navigate("login");
      addLine("login started. enter name.");
      return;
    }

    if (command === "register") {
      if (sessionUser) {
        addLine("already logged in. use logout first.");
        return;
      }
      setAuthFlow({ mode: "register", step: "name", name: "", email: "" });
      setAuthError("");
      navigate("register");
      addLine("register started. enter name.");
      return;
    }

    const directPages: Partial<Record<string, Page>> = {
      users: "users",
      friends: "friends",
      profile: "profile",
      discussions: "discussions",
      mail: "mail",
      games: "games",
    };

    const nextPage = directPages[command];
    if ((nextPage === "profile" || nextPage === "friends") && !sessionUser) {
      addLine(`login first to view ${nextPage === "profile" ? "your profile" : "friends"}.`);
      setAuthFlow({ mode: "login", step: "name", name: "" });
      setAuthError("");
      navigate("login");
      return;
    }

    if (nextPage) {
      await refreshBoard();
      navigate(nextPage);
    }
  }

  async function handleCommandHelpClick(commandLabel: string) {
    const commandName = commandLabel.split(/\s+/)[0] ?? "";
    const normalizedCommand = commandName.toLowerCase();
    const needsValue = commandLabel.includes("<");

    setCommandHelpOpen(false);

    if (authFlow || writeFlow) {
      if (["back", "cancel", "ctrl+c", "esc"].includes(normalizedCommand)) {
        addLine(normalizedCommand === "ctrl+c" ? "^C" : commandName);
        cancelInputMode();
      }
      return;
    }

    if (needsValue) {
      setCommandInput(`${commandName} `);
      window.setTimeout(() => commandInputRef.current?.focus(), 0);
      return;
    }

    await executeCommand(commandName);
  }

  async function handleAuthFlowInput(rawInput: string) {
    if (!authFlow) {
      return;
    }

    if (authFlow.mode === "login") {
      if (authFlow.step === "name") {
        setAuthFlow({ ...authFlow, step: "password", name: rawInput });
        addLine("name accepted. enter password.");
        return;
      }

      try {
        const nextUser = await login(authFlow.name, rawInput);
        setSessionUser(nextUser);
        setAuthFlow(null);
        setAuthError("");
        await refreshBoard();
        setPage("home");
        setPageStack([]);
        window.history.pushState(null, "", pagePaths.home);
        addLine(`logged in as ${nextUser.name}.`);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Login failed.");
        addLine("login failed. press Ctrl+C or Esc to quit, or enter name again.");
        setAuthFlow({ mode: "login", step: "name", name: "" });
      }
      return;
    }

    if (authFlow.step === "name") {
      setAuthFlow({ ...authFlow, step: "email", name: rawInput });
      addLine("name accepted. enter email.");
      return;
    }

    if (authFlow.step === "email") {
      setAuthFlow({ ...authFlow, step: "password", email: rawInput });
      addLine("email accepted. enter password.");
      return;
    }

    try {
      const nextUser = await register(authFlow.name, authFlow.email, rawInput);
      setSessionUser(nextUser);
      setAuthFlow(null);
      setAuthError("");
      await refreshBoard();
      setPage("home");
      setPageStack([]);
      window.history.pushState(null, "", pagePaths.home);
      addLine(`registered and logged in as ${nextUser.name}.`);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Registration failed.");
      addLine("registration failed. press Ctrl+C or Esc to quit, or enter name again.");
      setAuthFlow({ mode: "register", step: "name", name: "", email: "" });
    }
  }

  async function handleWriteFlowInput(rawInput: string) {
    if (!writeFlow) {
      return;
    }

    if (writeFlow.mode === "mail") {
      if (writeFlow.step === "recipient") {
        const recipient = await getUserByName(rawInput);

        if (!recipient) {
          setWriteError("Recipient name does not exist.");
          addLine("recipient not found. enter another name, or press Ctrl+C/Esc.");
          return;
        }

        setWriteError("");
        setWriteFlow({ mode: "mail", step: "title", recipient: recipient.name, title: "" });
        addLine(`recipient accepted: ${recipient.name}. enter title.`);
        return;
      }

      if (writeFlow.step === "title") {
        setWriteError("");
        setWriteFlow({ ...writeFlow, step: "body", title: rawInput });
        addLine("title accepted. enter message.");
        return;
      }

      try {
        await sendMail(writeFlow.recipient, writeFlow.title, rawInput);
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
        navigate("discussion-detail", `/discussions/show/${discussion.id}`);
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
      navigate("user-detail", `/users/show/${user.id}`);
      return;
    }

    if (page === "discussions") {
      const discussion = discussions[index];
      if (!discussion) {
        addLine("no discussion exists at that number.");
        return;
      }
      setSelectedDiscussion(await getDiscussion(discussion.id));
      navigate("discussion-detail", `/discussions/show/${discussion.id}`);
      return;
    }

    if (page === "mail") {
      const message = mail[index];
      if (!message) {
        addLine("no mail exists at that number.");
        return;
      }
      setSelectedMail(await getMail(message.id));
      navigate("mail-detail", `/mail/show/${message.id}`);
      return;
    }

    if (page === "friends") {
      const user = friends[index];
      if (!user) {
        addLine("no friend exists at that number.");
        return;
      }
      setSelectedUser(await getUser(user.id));
      navigate("user-detail", `/users/show/${user.id}`);
      return;
    }

    if (page === "games") {
      const selected = games[index];
      if (!selected) {
        addLine("no game exists at that number.");
        return;
      }
      if (!sessionUser) {
        addLine("login first to play games.");
        setAuthFlow({ mode: "login", step: "name", name: "" });
        setAuthError("");
        navigate("login");
        return;
      }
      setSelectedGame(selected);
      navigate("game-play", `/games/play/${selected.id}`);
      return;
    }

    addLine("enter is not available on this page.");
  }

  async function handleFriendCommand(
    action: "addfriend" | "removefriend",
    targetValue?: string,
  ) {
    if (!sessionUser) {
      addLine("login first to manage friends.");
      setAuthFlow({ mode: "login", step: "name", name: "" });
      setAuthError("");
      navigate("login");
      return;
    }

    const target = await resolveFriendTarget(targetValue);
    if (!target) {
      addLine(`usage: ${action} <number|name>`);
      return;
    }

    if (action === "addfriend") {
      await handleAddFriend(target.id);
      return;
    }

    await handleRemoveFriend(target.id);
  }

  async function resolveFriendTarget(targetValue?: string) {
    if (!targetValue && page === "user-detail") {
      return selectedUser;
    }

    if (!targetValue) {
      return null;
    }

    const index = Number(targetValue) - 1;
    if (!Number.isNaN(index) && index >= 0) {
      const source = page === "friends" ? friends : users;
      return source[index] ?? null;
    }

    return getUserByName(targetValue);
  }

  async function handleAddFriend(userId: number) {
    try {
      const target = await getUser(userId);
      await addFriend(userId);
      await refreshBoard();
      addLine(`added ${target?.name ?? findUserName(userId)} as friend.`);
    } catch (error) {
      addLine(error instanceof Error ? error.message : "could not add friend.");
    }
  }

  async function handleRemoveFriend(userId: number) {
    try {
      const target = await getUser(userId);
      await removeFriend(userId);
      await refreshBoard();
      addLine(`removed ${target?.name ?? findUserName(userId)} from friends.`);
    } catch (error) {
      addLine(error instanceof Error ? error.message : "could not remove friend.");
    }
  }

  async function handleProfileUpdate(update: { name: string; email: string; bio: string }) {
    try {
      const nextUser = await updateCurrentUserProfile(update);
      setSessionUser(nextUser);
      await refreshBoard();
      addLine("profile updated.");
    } catch (error) {
      addLine(error instanceof Error ? error.message : "could not update profile.");
      throw error;
    }
  }

  async function handleAvatarUpload(file: File) {
    if (!sessionUser) {
      throw new Error("Login first to upload an avatar.");
    }

    try {
      const avatarUrl = await uploadAvatar(file);
      const nextUser = await updateCurrentUserProfile({
        name: sessionUser.name,
        email: sessionUser.email,
        bio: sessionUser.bio,
        avatarUrl,
      });
      setSessionUser(nextUser);
      await refreshBoard();
      addLine("avatar uploaded.");
    } catch (error) {
      addLine(error instanceof Error ? error.message : "could not upload avatar.");
      throw error;
    }
  }

  function handleWriteCommand() {
    if (!sessionUser) {
      addLine("login first to write.");
      setAuthFlow({ mode: "login", step: "name", name: "" });
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
      setWriteFlow({ mode: "mail", step: "recipient", recipient: "", title: "" });
      setWriteError("");
      addLine("enter recipient name.");
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

  function handleCommandAreaClick(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;

    if (window.getSelection()?.toString()) {
      return;
    }

    if (target.closest("input, textarea, button")) {
      return;
    }

    commandInputRef.current?.focus();
  }

  return (
    <main className="terminal-page">
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
              : `connected as ${sessionUser ? sessionUser.name : "guest"}`}
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
          {page === "users" && <UsersPage users={users} friendIds={friendIds} />}
          {page === "user-detail" && (
            <UserDetailPage
              user={selectedUser}
              sessionUser={sessionUser}
              isFriend={selectedUser ? friendIds.has(selectedUser.id) : false}
              onAddFriend={handleAddFriend}
              onRemoveFriend={handleRemoveFriend}
            />
          )}
          {page === "friends" && <FriendsPage friends={friends} />}
          {page === "login" && <LoginPage flow={authFlow} error={authError} />}
          {page === "register" && <RegisterPage flow={authFlow} error={authError} />}
          {page === "profile" && (
            <ProfilePage
              key={
                sessionUser
                  ? `${sessionUser.id}:${sessionUser.name}:${sessionUser.email}`
                  : "guest-profile"
              }
              sessionUser={sessionUser}
              onUpdateProfile={handleProfileUpdate}
              onAvatarUpload={handleAvatarUpload}
            />
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
          {page === "game-play" && (
            <GamePlayPage
              game={selectedGame}
              sessionUser={sessionUser}
              onBack={() => navigate("games")}
            />
          )}
        </section>

        <footer className="terminal-footer">
          <pre className="ascii-rule" aria-hidden="true">
----------------------------------------------------
          </pre>
          <p>
            available:{" "}
            <span>{availableCommands.join(" | ")}</span>
          </p>
          <form
            onSubmit={handleCommandSubmit}
            className="command-form"
            onClick={handleCommandAreaClick}
          >
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
      <div className={`command-help ${commandHelpOpen ? "open" : ""}`}>
        {commandHelpOpen && (
          <div className="command-help-popover" role="menu" aria-label="Available commands">
            {availableCommands.map((command) => (
              <button
                key={command}
                type="button"
                role="menuitem"
                onClick={() => {
                  void handleCommandHelpClick(command);
                }}
              >
                {command}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="command-help-toggle"
          aria-label="Show available commands"
          aria-expanded={commandHelpOpen}
          onClick={() => setCommandHelpOpen((isOpen) => !isOpen)}
        >
          ?
        </button>
      </div>
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

  return `${sessionUser?.name ?? "guest"}@ft_transcendence:$`;
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
        Welcome {sessionUser?.name ?? "guest"}. Choose a board section with commands.
      </p>
      <ol className="terminal-list">
        <li>discussions - public posts and replies</li>
        <li>users - board member list</li>
        <li>friends - saved users and online status</li>
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

function AvatarImage({
  user,
  size = "small",
}: {
  user: Pick<UserProfile, "name" | "avatarUrl">;
  size?: "small" | "large";
}) {
  return (
    <img
      className={`avatar-image ${size === "large" ? "large" : ""}`}
      src={user.avatarUrl || DEFAULT_AVATAR_URL}
      alt={`${user.name} avatar`}
    />
  );
}

function UsersPage({
  users,
  friendIds,
}: {
  users: UserProfile[];
  friendIds: Set<number>;
}) {
  return (
    <TerminalSection title="Users">
      {users.length === 0 ? (
        <p className="terminal-copy">No users available.</p>
      ) : (
        <ol className="terminal-list numbered user-list">
          {users.map((user) => (
            <li key={user.id}>
              <AvatarImage user={user} />
              <span>{user.name}</span>
              <small>
                {user.email} / {user.status}
                {friendIds.has(user.id) ? " / friend" : ""}
              </small>
            </li>
          ))}
        </ol>
      )}
    </TerminalSection>
  );
}

function UserDetailPage({
  user,
  sessionUser,
  isFriend,
  onAddFriend,
  onRemoveFriend,
}: {
  user: UserProfile | null;
  sessionUser: SessionUser | null;
  isFriend: boolean;
  onAddFriend: (userId: number) => Promise<void>;
  onRemoveFriend: (userId: number) => Promise<void>;
}) {
  if (!user) {
    return <TerminalSection title="User">No user selected.</TerminalSection>;
  }

  const canManageFriendship = Boolean(sessionUser && sessionUser.id !== user.id);

  return (
    <TerminalSection title={`User: ${user.name}`}>
      <div className="profile-layout">
        <AvatarImage user={user} size="large" />
        <div>
          <dl className="terminal-facts">
            <dt>ID</dt>
            <dd>{user.id}</dd>
            <dt>Name</dt>
            <dd>{user.name}</dd>
            <dt>Email</dt>
            <dd>{user.email}</dd>
            <dt>Status</dt>
            <dd>{user.status}</dd>
            <dt>Bio</dt>
            <dd>{user.bio}</dd>
          </dl>
          {canManageFriendship && (
            <div className="friend-actions">
              <button
                className="terminal-button"
                type="button"
                onClick={() => {
                  void (isFriend ? onRemoveFriend(user.id) : onAddFriend(user.id));
                }}
              >
                {isFriend ? "remove friend" : "add friend"}
              </button>
            </div>
          )}
        </div>
      </div>
    </TerminalSection>
  );
}

function FriendsPage({ friends }: { friends: UserProfile[] }) {
  return (
    <TerminalSection title="Friends">
      {friends.length === 0 ? (
        <p className="terminal-copy">No friends added yet.</p>
      ) : (
        <ol className="terminal-list numbered user-list">
          {friends.map((friend) => (
            <li key={friend.id}>
              <AvatarImage user={friend} />
              <span>{friend.name}</span>
              <small>
                {friend.email} / {friend.status}
              </small>
            </li>
          ))}
        </ol>
      )}
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
      <p className="terminal-copy">Registration sends name, email, and password to `/users/create`.</p>
      <p className="terminal-copy">Press Ctrl+C or Esc to quit register.</p>
      {error && <p className="terminal-error">{error}</p>}
    </TerminalSection>
  );
}

function ProfilePage({
  sessionUser,
  onUpdateProfile,
  onAvatarUpload,
}: {
  sessionUser: SessionUser | null;
  onUpdateProfile: (update: { name: string; email: string; bio: string }) => Promise<void>;
  onAvatarUpload: (file: File) => Promise<void>;
}) {
  const [name, setName] = useState(sessionUser?.name ?? "");
  const [email, setEmail] = useState(sessionUser?.email ?? "");
  const [bio, setBio] = useState(sessionUser?.bio ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!sessionUser) {
    return <TerminalSection title="Profile">Not logged in.</TerminalSection>;
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      await onUpdateProfile({ name, email, bio });
      setMessage("saved.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "could not save profile.");
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setMessage("");
    setError("");

    try {
      await onAvatarUpload(file);
      setMessage("avatar saved.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "could not save avatar.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <TerminalSection title="Profile">
      <div className="profile-layout">
        <AvatarImage user={sessionUser} size="large" />
        <div>
          <dl className="terminal-facts">
            <dt>Name</dt>
            <dd>{sessionUser.name}</dd>
            <dt>Email</dt>
            <dd>{sessionUser.email}</dd>
            <dt>Status</dt>
            <dd>{sessionUser.status}</dd>
            <dt>Bio</dt>
            <dd>{sessionUser.bio}</dd>
          </dl>
          <form className="profile-form" onSubmit={handleSubmit}>
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              Bio
              <textarea value={bio} onChange={(event) => setBio(event.target.value)} />
            </label>
            <label>
              Avatar
              <input type="file" accept="image/*" onChange={handleAvatarChange} />
            </label>
            <button className="terminal-button" type="submit">
              save profile
            </button>
          </form>
          {message && <p className="terminal-copy">{message}</p>}
          {error && <p className="terminal-error">{error}</p>}
        </div>
      </div>
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
            <span>{discussion.name}</span>
            <small>
              {discussion.nPosts} posts / {discussion.info}
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
    <TerminalSection title={discussion.name}>
      <p className="terminal-copy">{discussion.info}</p>
      <div className="post-list">
        {discussion.posts.map((post) => (
          <article key={post.id}>
            <header>{findUserName(post.author)} / {post.name}</header>
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
              <span>{message.title}</span>
              <small>
                {message.sender === sessionUser?.id
                  ? `sent to ${findUserName(message.recipient)}`
                  : `from ${findUserName(message.sender)}`}
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
        <dd>{findUserName(message.sender)}</dd>
        <dt>To</dt>
        <dd>{findUserName(message.recipient)}</dd>
        <dt>Title</dt>
        <dd>{message.title}</dd>
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
              <small>by {findUserName(game.author)} / {game.body}</small>
            </li>
          ))}
        </ol>
      )}
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
