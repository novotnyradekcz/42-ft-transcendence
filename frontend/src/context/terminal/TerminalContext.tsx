import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAvailableCommands } from "../../commands";
import { PAGE_PATHS, pageFromPath } from "../../router";
import type { AuthFlow, WriteFlow } from "../../terminalTypes";
import { useTranslation } from "../language/i18n";
import { initModeration } from "../../components/moderation";
import { useData } from "../data/useData";
import { useSession } from "../session/useSession";
import { createAuthFlowHandlers } from "./authFlow";
import { createCommandHandlers } from "./commandHandlers";
import { createWriteFlowHandlers } from "./writeFlow";
import type { TerminalDeps } from "./deps";
import { getPromptLabel as promptLabel } from "./helpers";
import { TerminalContext } from "./useTerminal";

export function TerminalProvider({ children }: { children: ReactNode }) {
  const { t, setLang } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const page = useMemo(
    () => pageFromPath(location.pathname),
    [location.pathname],
  );

  useEffect(() => {
    initModeration();
  }, []);

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
  const [terminalLines, setTerminalLines] = useState<string[]>(() => [
    t("ft_transcendence BBS ready."),
    t("Type `menu` to enter."),
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

  // ─── Handlers (extracted into sibling modules) ─────────────────────────────

  const deps: TerminalDeps = {
    page,
    sessionUser,
    knownUsers,
    login,
    register,
    contextLogout,
    updateSessionUser,
    refreshUsers,
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
    authFlow,
    setAuthFlow,
    setAuthError,
    writeFlow,
    setWriteFlow,
    setWriteError,
    setCommandHelpOpen,
    addLine,
    clearWriteModes,
    goTo,
    goBack,
    t,
    setLang,
    navigate,
  };

  const { handleAuthFlowInput } = createAuthFlowHandlers(deps);
  const { handleWriteFlowInput, handleWriteCommand } =
    createWriteFlowHandlers(deps);
  const { executeCommand } = createCommandHandlers(deps, handleWriteCommand);

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
      addLine(t("login/register cancelled."));
      return;
    }
    if (writeFlow) {
      clearWriteModes();
      setCommandInput("");
      addLine(t("write cancelled."));
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
    return promptLabel(authFlow, writeFlow, sessionUser);
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
