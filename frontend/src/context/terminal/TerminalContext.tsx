// The command line: what's typed, what it does, and what the prompt says.
//
// Only the state and the wiring live here. The work is split into three handler
// modules — authFlow, writeFlow and commandHandlers — which this file builds
// each render and hands a `deps` object holding everything they need.
//
// Submitted input goes to whichever of the three is in charge: an auth flow if
// one is running, then a write flow, otherwise it's a command.
//
// Two counters guard against late answers. flowEpoch is bumped on every cancel,
// so a request that lands after the user pressed Ctrl+C is discarded rather
// than acted on; helpMenuEpoch does the same for the ? menu's provider list.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { baseCommand, getAvailableCommands } from "../../commands";
import { PAGE_PATHS, pageFromPath, parentPath } from "../../router";
import type { AuthFlow, WriteFlow } from "../../terminalTypes";
import { useTranslation } from "../language/i18n";
import { initModeration } from "../../components/moderation";
import { useData } from "../data/useData";
import { useSession } from "../session/useSession";
import { createAuthFlowHandlers } from "./authFlow";
import { createCommandHandlers } from "./commandHandlers";
import { createWriteFlowHandlers } from "./writeFlow";
import {
  buildSubmenu,
  loadOAuthOptions,
  opensSubmenu,
  type HelpSubmenu,
} from "./helpMenu";
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

  // starts fetching the swear list now, so the first `write` isn't waiting on it
  useEffect(() => {
    initModeration();
  }, []);

  const {
    sessionUser,
    knownUsers,
    isRestoring,
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
    ensureForPage,
    refreshForPage,
    refreshBoardForUser,
  } = useData();

  const [commandInput, setCommandInput] = useState("");
  const [terminalLines, setTerminalLines] = useState<string[]>(() => [
    t("ft_transcendence BBS ready."),
    // restoreSession() is synchronous, so sessionUser is already correct here
    sessionUser
      ? t("Type `menu` to enter.")
      : t("Type `login` or `register` to enter."),
  ]);
  // bumped when the input should take focus; Terminal watches it. a counter
  // rather than a boolean, so asking twice in a row still registers
  const [focusInputSignal, setFocusInputSignal] = useState(0);

  // opening /users/login directly should arm the prompt, same as typing `login`
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
  // second layer of the ? menu, null while the command list is showing
  const [helpSubmenu, setHelpSubmenu] = useState<HelpSubmenu | null>(null);
  // bumped on every open, so a slow provider list can tell it's stale
  const helpMenuEpoch = useRef(0);
  // raised while a command waits on the network
  // the ref blocks re-entry, the state renders the loading line
  const [isBusy, setIsBusy] = useState(false);
  const busyRef = useRef(false);
  // hidden by default, toggled by the `log` command
  const [logVisible, setLogVisible] = useState(false);
  // bumped by every cancel, so a late reply can tell it's no longer wanted
  const flowEpoch = useRef(0);

  // keeps the auth flow in sync with the url, during render so the prompt
  // never paints a frame belonging to the page the user just left
  const [flowPage, setFlowPage] = useState(page);
  if (flowPage !== page) {
    setFlowPage(page);
    if (page === "login") {
      setAuthFlow((flow) =>
        flow?.mode === "login" ? flow : { mode: "login", step: "name", name: "" },
      );
    } else if (page === "register") {
      setAuthFlow((flow) =>
        flow?.mode === "register"
          ? flow
          : { mode: "register", step: "name", name: "", email: "" },
      );
    } else {
      setAuthFlow(null);
      setAuthError("");
    }
    // a write flow belongs to the page it started on, so leaving drops it
    setWriteFlow(null);
    setWriteError("");
    // so does the second help layer — it lists what the old page was showing
    setHelpSubmenu(null);
  }

  // the second layer only exists inside an open popover, so both close together
  function closeCommandHelp() {
    helpMenuEpoch.current += 1;
    setCommandHelpOpen(false);
    setHelpSubmenu(null);
  }

  function toggleCommandHelp() {
    if (commandHelpOpen) closeCommandHelp();
    else setCommandHelpOpen(true);
  }

  // what the footer advertises, and what the ? popover lists
  const availableCommands = useMemo(
    () => getAvailableCommands(page, Boolean(sessionUser)),
    [page, sessionUser],
  );

  // the log keeps the last nine lines; the footer shows the newest one even
  // when the log itself is hidden
  const addLine = useCallback((line: string) => {
    setTerminalLines((lines) => [...lines.slice(-8), line]);
  }, []);

  // loads what the page on screen renders, and nothing else. replaces the old
  // load-everything-at-startup: this runs on navigation and on login/logout,
  // and refetches content each visit so changes made elsewhere show up. it
  // runs behind the page rather than blocking the command that navigated
  // there, so failures land in the log as they arrive.
  useEffect(() => {
    // wait for a saved session to finish restoring — loading first would fetch
    // as a guest and then have to be redone
    if (isRestoring) return;

    let cancelled = false;
    void ensureForPage(page).then((errors) => {
      if (!cancelled) errors.forEach(addLine);
    });
    return () => {
      cancelled = true;
    };
    // ensureForPage is deliberately not a dependency: its identity changes
    // whenever knownUsers does, and since content refetches on every call,
    // depending on it would fire a second identical request the moment the
    // first one lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sessionUser?.id, isRestoring]);

  // leaving a page abandons whatever was being written on it
  function clearWriteModes() {
    setWriteFlow(null);
    setWriteError("");
  }

  function goTo(path: string) {
    clearWriteModes();
    navigate(path);
  }

  // `back` walks the PAGE_PARENTS tree, not browser history — history would
  // take the user back through pages they cancelled out of
  function goBack() {
    clearWriteModes();
    const target = parentPath(page, Boolean(sessionUser));
    // root pages have nowhere above them, don't fall back to browser history
    if (!target) {
      addLine(t("nothing to go back to."));
      return;
    }
    navigate(target);
  }

  // everything the handler modules need, passed in one object
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
    ensureForPage,
    refreshForPage,
    refreshBoardForUser,
    authFlow,
    setAuthFlow,
    setAuthError,
    flowEpoch,
    writeFlow,
    setWriteFlow,
    setWriteError,
    closeCommandHelp,
    logVisible,
    setLogVisible,
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

  // runs an action with the busy flag raised for its duration
  async function runBusy(action: () => Promise<void>): Promise<void> {
    busyRef.current = true;
    setIsBusy(true);
    try {
      await action();
    } finally {
      busyRef.current = false;
      setIsBusy(false);
    }
  }

  // one entry point for everything typed at the prompt: an auth flow gets first
  // refusal, then a write flow, and anything else is a command
  async function handleCommandSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rawInput = commandInput.trim();
    if (!rawInput) return;
    // checked before clearing, so a held enter key doesn't eat what was typed
    if (busyRef.current) return;
    setCommandInput("");

    await runBusy(async () => {
      if (authFlow) {
        await handleAuthFlowInput(rawInput);
        return;
      }
      if (writeFlow) {
        await handleWriteFlowInput(rawInput);
        return;
      }
      await executeCommand(rawInput);
    });
  }

  // Ctrl+C and Esc cancel, the same way they would in a real terminal
  function handleCommandKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.ctrlKey && event.key.toLowerCase() === "c") {
      // selected text means the user is copying, not cancelling
      const input = event.currentTarget;
      if (input.selectionStart !== input.selectionEnd) return;
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

  // cancels the innermost thing that's running: a flow if there is one,
  // otherwise it's read as `back`
  function cancelInputMode() {
    // invalidate in-flight requests first, so late replies get discarded
    flowEpoch.current += 1;
    if (authFlow) {
      setAuthFlow(null);
      setAuthError("");
      setCommandInput("");
      // replaced, not pushed, so back doesn't re-arm the abandoned login page
      navigate(sessionUser ? PAGE_PATHS.home : PAGE_PATHS.welcome, {
        replace: true,
      });
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

  // runs a command picked from the help list instead of typed
  async function handleCommandHelpClick(commandLabel: string) {
    const commandName = commandLabel.split(/\s+/)[0] ?? "";
    // normalised through the same helper the command table uses
    const normalizedCommand = baseCommand(commandLabel);
    const needsValue = commandLabel.includes("<");

    if (busyRef.current) return;

    // a command that takes a value opens the second layer rather than
    // running, so the popover stays up to show the choices
    if (!authFlow && !writeFlow && opensSubmenu(commandLabel)) {
      openHelpSubmenu(commandLabel);
      return;
    }

    closeCommandHelp();

    if (authFlow || writeFlow) {
      if (["back", "cancel", "ctrl+c", "esc"].includes(normalizedCommand)) {
        addLine(normalizedCommand === "ctrl+c" ? "^C" : commandName);
        cancelInputMode();
      }
      return;
    }

    // nothing to enumerate: fall back to prefilling the prompt
    if (needsValue) {
      setCommandInput(`${commandName} `);
      setFocusInputSignal((n) => n + 1);
      return;
    }

    await runBusy(() => executeCommand(commandName));
  }

  // opens the second layer. everything but oauth is built from data already in
  // memory, so only that one has a loading state to fill in
  function openHelpSubmenu(commandLabel: string) {
    const submenu = buildSubmenu(commandLabel, deps);
    setHelpSubmenu(submenu);
    if (!submenu.loading) return;

    // oauth only: the provider list comes from the server
    const epoch = (helpMenuEpoch.current += 1);
    void loadOAuthOptions()
      .then((options) => {
        if (helpMenuEpoch.current !== epoch) return;
        setHelpSubmenu((current) =>
          current?.command === submenu.command
            ? { ...current, options, loading: false }
            : current,
        );
      })
      .catch(() => {
        if (helpMenuEpoch.current !== epoch) return;
        setHelpSubmenu((current) =>
          current?.command === submenu.command
            ? { ...current, loading: false }
            : current,
        );
      });
  }

  // runs the command the second layer belongs to, with the picked value
  async function handleCommandHelpSelect(value: string) {
    if (busyRef.current || !helpSubmenu) return;
    const { command } = helpSubmenu;
    closeCommandHelp();
    await runBusy(() => executeCommand(`${command} ${value}`));
  }

  // back to the first layer, the command list
  function closeCommandHelpSubmenu() {
    helpMenuEpoch.current += 1;
    setHelpSubmenu(null);
  }

  // the text left of the cursor, e.g. `login/password:` or `nspalevi@...:$`
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
        logVisible,
        authFlow,
        authError,
        writeFlow,
        writeError,
        commandHelpOpen,
        toggleCommandHelp,
        helpSubmenu,
        availableCommands,
        isBusy,
        page,
        handleCommandSubmit,
        handleCommandKeyDown,
        handleCommandHelpClick,
        handleCommandHelpSelect,
        closeCommandHelpSubmenu,
        cancelInputMode,
        getPromptLabel,
      }}
    >
      {children}
    </TerminalContext.Provider>
  );
}
