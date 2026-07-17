import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  addFriend as apiAddFriend,
  createDiscussion,
  createPost,
  getDiscussion,
  getMail,
  getUser,
  getUserByName,
  removeFriend as apiRemoveFriend,
  sendMail,
} from "../api";
import {
  commandDefinitions,
  getAvailableCommands,
  isCommand,
  parseCommand,
} from "../commands";
import { PAGE_PATHS, pageFromPath } from "../router";
import type { AuthFlow, WriteFlow } from "../terminalTypes";
import { useData } from "./DataContext";
import { useSession } from "./SessionContext";
import type { Page } from "../types";

export type { AuthFlow, WriteFlow };

// ─── Utility ──────────────────────────────────────────────────────────────────

function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

// ─── Context interface ────────────────────────────────────────────────────────

export interface TerminalContextValue {
  /** Current text in the command input. */
  commandInput: string;
  setCommandInput: Dispatch<SetStateAction<string>>;
  /** Rendered lines in the terminal output panel. */
  terminalLines: string[];
  /** Append a line to the terminal output. */
  addLine: (line: string) => void;
  /** Incremented whenever the terminal context wants the input to be focused. */
  focusInputSignal: number;

  authFlow: AuthFlow;
  authError: string;
  writeFlow: WriteFlow;
  writeError: string;

  commandHelpOpen: boolean;
  setCommandHelpOpen: Dispatch<SetStateAction<boolean>>;
  availableCommands: string[];
  page: Page;

  handleCommandSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleCommandKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  handleCommandHelpClick: (label: string) => Promise<void>;
  cancelInputMode: () => void;
  getPromptLabel: () => string;
}

const TerminalContext = createContext<TerminalContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TerminalProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const page = useMemo(
    () => pageFromPath(location.pathname),
    [location.pathname],
  );

  const {
    sessionUser,
    knownUsers,
    login,
    register,
    logout: contextLogout,
    updateSessionUser,
    refreshUsers,
  } = useSession();

  const {
    discussions,
    mail,
    games,
    friends,
    selectedDiscussion,
    selectedUser,
    setSelectedDiscussion,
    setSelectedMail,
    setSelectedGame,
    setSelectedUser,
    refreshBoard,
    refreshBoardForUser,
  } = useData();

  // ─── Terminal state ───────────────────────────────────────────────────────

  const [commandInput, setCommandInput] = useState("");
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "ft_transcendence BBS ready.",
    "Type `menu` to enter.",
  ]);
  const [focusInputSignal, setFocusInputSignal] = useState(0);

  const [authFlow, setAuthFlow] = useState<AuthFlow>(() => {
    const p = pageFromPath(window.location.pathname);
    if (p === "login") return { mode: "login", step: "name", name: "" };
    if (p === "register")
      return { mode: "register", step: "name", name: "", email: "" };
    return null;
  });
  const [authError, setAuthError] = useState("");
  const [writeFlow, setWriteFlow] = useState<WriteFlow>(null);
  const [writeError, setWriteError] = useState("");
  const [commandHelpOpen, setCommandHelpOpen] = useState(false);

  const availableCommands = useMemo(
    () => getAvailableCommands(page, Boolean(sessionUser)),
    [page, sessionUser],
  );

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const addLine = useCallback((line: string) => {
    setTerminalLines((lines) => [...lines.slice(-8), line]);
  }, []);

  function clearWriteModes() {
    setWriteFlow(null);
    setWriteError("");
  }

  function goTo(path: string) {
    clearWriteModes();
    navigate(path);
  }

  function goBack() {
    clearWriteModes();
    navigate(-1);
  }

  // ─── Command submit ───────────────────────────────────────────────────────

  async function handleCommandSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rawInput = commandInput.trim();
    if (!rawInput) return;
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

  // ─── Execute command ──────────────────────────────────────────────────────

  async function executeCommand(rawInput: string, echo = true) {
    setCommandHelpOpen(false);
    if (echo) addLine(`> ${rawInput}`);

    const { name, args } = parseCommand(rawInput);
    const definition = commandDefinitions.find((cmd) => isCommand(name, cmd));
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
      goTo(PAGE_PATHS.help);
      return;
    }

    if (command === "menu") {
      clearWriteModes();
      navigate(PAGE_PATHS.home);
      return;
    }

    if (command === "back") {
      goBack();
      return;
    }

    if (command === "list") {
      const errors = await refreshBoard();
      errors.forEach(addLine);
      if (errors.length === 0) addLine(`refreshed ${page}.`);
      return;
    }

    if (command === "logout") {
      contextLogout();
      setSelectedMail(null);
      setSelectedUser(null);
      navigate(PAGE_PATHS.home);
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
      goTo(PAGE_PATHS.login);
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
      goTo(PAGE_PATHS.register);
      addLine("register started. enter name.");
      return;
    }

    const directPaths: Partial<Record<string, string>> = {
      users: PAGE_PATHS.users,
      friends: PAGE_PATHS.friends,
      profile: PAGE_PATHS.profile,
      discussions: PAGE_PATHS.discussions,
      mail: PAGE_PATHS.mail,
      games: PAGE_PATHS.games,
    };

    const nextPath = directPaths[command];

    if ((command === "profile" || command === "friends") && !sessionUser) {
      const target = command === "profile" ? "your profile" : "friends";
      addLine(`login first to view ${target}.`);
      setAuthFlow({ mode: "login", step: "name", name: "" });
      setAuthError("");
      goTo(PAGE_PATHS.login);
      return;
    }

    if (nextPath) {
      const errors = await refreshBoard();
      errors.forEach(addLine);
      goTo(nextPath);
    }
  }

  // ─── Auth flow ────────────────────────────────────────────────────────────

  async function handleAuthFlowInput(rawInput: string) {
    if (!authFlow) return;

    if (authFlow.mode === "login") {
      if (authFlow.step === "name") {
        setAuthFlow({ ...authFlow, step: "password", name: rawInput });
        addLine("name accepted. enter password.");
        return;
      }
      try {
        const nextUser = await login(authFlow.name, rawInput);
        setAuthFlow(null);
        setAuthError("");
        (await refreshBoardForUser(nextUser)).forEach(addLine);
        navigate(PAGE_PATHS.home);
        addLine(`logged in as ${nextUser.name}.`);
      } catch (error) {
        setAuthError(errMsg(error, "Login failed."));
        addLine(
          "login failed. press Ctrl+C or Esc to quit, or enter name again.",
        );
        setAuthFlow({ mode: "login", step: "name", name: "" });
      }
      return;
    }

    // register
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
      setAuthFlow(null);
      setAuthError("");
      (await refreshBoardForUser(nextUser)).forEach(addLine);
      navigate(PAGE_PATHS.home);
      addLine(`registered and logged in as ${nextUser.name}.`);
    } catch (error) {
      setAuthError(errMsg(error, "Registration failed."));
      addLine(
        "registration failed. press Ctrl+C or Esc to quit, or enter name again.",
      );
      setAuthFlow({ mode: "register", step: "name", name: "", email: "" });
    }
  }

  // ─── Write flow ───────────────────────────────────────────────────────────

  async function handleWriteFlowInput(rawInput: string) {
    if (!writeFlow || !sessionUser) return;

    if (writeFlow.mode === "mail") {
      if (writeFlow.step === "recipient") {
        const recipient = await getUserByName(rawInput).catch(() => null);
        if (!recipient) {
          setWriteError("Recipient name does not exist.");
          addLine(
            "recipient not found. enter another name, or press Ctrl+C/Esc.",
          );
          return;
        }
        setWriteError("");
        setWriteFlow({
          mode: "mail",
          step: "title",
          recipient: recipient.name,
          title: "",
        });
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
        await sendMail(
          sessionUser.id,
          writeFlow.recipient,
          writeFlow.title,
          rawInput,
        );
        const recipientName = writeFlow.recipient;
        clearWriteModes();
        (await refreshBoard()).forEach(addLine);
        addLine(`mail sent to ${recipientName}.`);
      } catch (error) {
        setWriteError(errMsg(error, "Could not send mail."));
        addLine(
          "mail failed. press Ctrl+C/Esc to quit, or enter message again.",
        );
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
        const discussion = await createDiscussion(
          writeFlow.title,
          rawInput,
          sessionUser.id,
        );
        setSelectedDiscussion(discussion);
        clearWriteModes();
        (await refreshBoard()).forEach(addLine);
        navigate(`/discussions/show/${discussion.id}`);
        addLine("discussion posted.");
      } catch (error) {
        setWriteError(errMsg(error, "Could not write discussion."));
        addLine(
          "discussion failed. press Ctrl+C/Esc to quit, or enter post again.",
        );
      }
      return;
    }

    // reply
    try {
      const discussion = await createPost(
        writeFlow.discussionId,
        rawInput,
        sessionUser.id,
      );
      setSelectedDiscussion(discussion);
      clearWriteModes();
      (await refreshBoard()).forEach(addLine);
      addLine("reply posted.");
    } catch (error) {
      setWriteError(errMsg(error, "Could not post reply."));
      addLine("reply failed. press Ctrl+C/Esc to quit, or enter reply again.");
    }
  }

  // ─── Enter command ────────────────────────────────────────────────────────

  async function handleEnterCommand(indexValue?: string) {
    const index = Number(indexValue) - 1;
    if (!indexValue || Number.isNaN(index) || index < 0) {
      addLine("usage: enter <number>");
      return;
    }

    if (page === "users") {
      const user = knownUsers[index];
      if (!user) {
        addLine("no user exists at that number.");
        return;
      }
      try {
        setSelectedUser(await getUser(user.id));
        navigate(`/users/show/${user.id}`);
      } catch (e) {
        addLine(errMsg(e, "could not load user."));
      }
      return;
    }

    if (page === "discussions") {
      const discussion = discussions[index];
      if (!discussion) {
        addLine("no discussion exists at that number.");
        return;
      }
      try {
        setSelectedDiscussion(await getDiscussion(discussion.id));
        navigate(`/discussions/show/${discussion.id}`);
      } catch (e) {
        addLine(errMsg(e, "could not load discussion."));
      }
      return;
    }

    if (page === "mail") {
      const message = mail[index];
      if (!message) {
        addLine("no mail exists at that number.");
        return;
      }
      try {
        setSelectedMail(await getMail(message.id));
        navigate(`/mail/show/${message.id}`);
      } catch (e) {
        addLine(errMsg(e, "could not load mail."));
      }
      return;
    }

    if (page === "friends") {
      const user = friends[index];
      if (!user) {
        addLine("no friend exists at that number.");
        return;
      }
      try {
        setSelectedUser(await getUser(user.id));
        navigate(`/users/show/${user.id}`);
      } catch (e) {
        addLine(errMsg(e, "could not load user."));
      }
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
        goTo(PAGE_PATHS.login);
        return;
      }
      setSelectedGame(selected);
      navigate(`/games/play/${selected.id}`);
      return;
    }

    addLine("enter is not available on this page.");
  }

  // ─── Friend commands ──────────────────────────────────────────────────────

  async function handleFriendCommand(
    action: "addfriend" | "removefriend",
    targetValue?: string,
  ) {
    if (!sessionUser) {
      addLine("login first to manage friends.");
      setAuthFlow({ mode: "login", step: "name", name: "" });
      setAuthError("");
      goTo(PAGE_PATHS.login);
      return;
    }

    const target = await resolveFriendTarget(targetValue);
    if (!target) {
      addLine(`usage: ${action} <number|name>`);
      return;
    }

    if (action === "addfriend") {
      await handleAddFriend(target.id);
    } else {
      await handleRemoveFriend(target.id);
    }
  }

  async function resolveFriendTarget(targetValue?: string) {
    if (!targetValue && page === "user-detail") return selectedUser;
    if (!targetValue) return null;
    const index = Number(targetValue) - 1;
    if (!Number.isNaN(index) && index >= 0) {
      const source = page === "friends" ? friends : knownUsers;
      return source[index] ?? null;
    }
    return getUserByName(targetValue).catch(() => null);
  }

  async function handleAddFriend(userId: number) {
    if (!sessionUser) return;
    try {
      await apiAddFriend(sessionUser.id, userId);
      updateSessionUser({
        ...sessionUser,
        friends: [...new Set([...sessionUser.friends, userId])],
      });
      const target = knownUsers.find((u) => u.id === userId);
      addLine(`added ${target?.name ?? `user#${userId}`} as friend.`);
      await refreshUsers().catch(() => {});
    } catch (e) {
      addLine(errMsg(e, "could not add friend."));
    }
  }

  async function handleRemoveFriend(userId: number) {
    if (!sessionUser) return;
    try {
      await apiRemoveFriend(sessionUser.id, userId);
      updateSessionUser({
        ...sessionUser,
        friends: sessionUser.friends.filter((id) => id !== userId),
      });
      const target = knownUsers.find((u) => u.id === userId);
      addLine(`removed ${target?.name ?? `user#${userId}`} from friends.`);
      await refreshUsers().catch(() => {});
    } catch (e) {
      addLine(errMsg(e, "could not remove friend."));
    }
  }

  // ─── Profile handlers (called by ProfilePage via context) ─────────────────

  // ProfilePage now accesses updateCurrentUserProfile and uploadAvatar directly
  // from api.ts, and addLine from this context. No handler delegation needed.

  // ─── Write command ────────────────────────────────────────────────────────

  function handleWriteCommand() {
    if (!sessionUser) {
      addLine("login first to write.");
      setAuthFlow({ mode: "login", step: "name", name: "" });
      setAuthError("");
      goTo(PAGE_PATHS.login);
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
      setWriteFlow({
        mode: "mail",
        step: "recipient",
        recipient: "",
        title: "",
      });
      setWriteError("");
      addLine("enter recipient name.");
      return;
    }

    addLine("write is not available on this page.");
  }

  // ─── Keyboard ─────────────────────────────────────────────────────────────

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
      navigate(PAGE_PATHS.home);
      addLine("login/register cancelled.");
      return;
    }
    if (writeFlow) {
      clearWriteModes();
      setCommandInput("");
      addLine("write cancelled.");
      return;
    }
    goBack();
  }

  // ─── Command help ─────────────────────────────────────────────────────────

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
      setFocusInputSignal((n) => n + 1);
      return;
    }

    await executeCommand(commandName);
  }

  // ─── Prompt label ─────────────────────────────────────────────────────────

  function getPromptLabel(): string {
    if (authFlow?.mode === "login") return `login/${authFlow.step}:`;
    if (authFlow?.mode === "register") return `register/${authFlow.step}:`;
    if (writeFlow?.mode === "mail") return `mail/${writeFlow.step}:`;
    if (writeFlow?.mode === "new-discussion")
      return `discussion/${writeFlow.step}:`;
    if (writeFlow?.mode === "reply") return "reply/body:";
    if (!sessionUser) return "guest@ft_transcendence:$";
    return `${sessionUser.name}@ft_transcendence:$`;
  }

  return (
    <TerminalContext.Provider
      value={{
        commandInput,
        setCommandInput,
        terminalLines,
        addLine,
        focusInputSignal,
        authFlow,
        authError,
        writeFlow,
        writeError,
        commandHelpOpen,
        setCommandHelpOpen,
        availableCommands,
        page,
        handleCommandSubmit,
        handleCommandKeyDown,
        handleCommandHelpClick,
        cancelInputMode,
        getPromptLabel,
      }}
    >
      {children}
    </TerminalContext.Provider>
  );
}

export function useTerminal(): TerminalContextValue {
  const ctx = useContext(TerminalContext);
  if (!ctx)
    throw new Error("useTerminal must be used within a <TerminalProvider>");
  return ctx;
}
