import { useEffect, useRef, type MouseEvent } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { useData } from "../context/DataContext";
import { useSession } from "../context/SessionContext";
import { useTerminal } from "../context/TerminalContext";
import { pageFromPath } from "../router";
import GamePlayPage from "../pages/GamePlayPage";
import DiscussionDetailPage from "../pages/DiscussionDetailPage";
import DiscussionsPage from "../pages/DiscussionsPage";
import FriendsPage from "../pages/FriendsPage";
import GamesPage from "../pages/GamesPage";
import HelpPage from "../pages/HelpPage";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import MailDetailPage from "../pages/MailDetailPage";
import MailPage from "../pages/MailPage";
import ProfilePage from "../pages/ProfilePage";
import RegisterPage from "../pages/RegisterPage";
import UserDetailPage from "../pages/UserDetailPage";
import UsersPage from "../pages/UsersPage";
import WelcomePage from "../pages/WelcomePage";
export default function Terminal() {
  const commandInputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLElement>(null);

  const location = useLocation();
  const page = pageFromPath(location.pathname);

  const { sessionUser } = useSession();
  // selectedGame needed by GamePlayPage route
  const { selectedGame } = useData();

  const {
    commandInput,
    setCommandInput,
    terminalLines,
    focusInputSignal,
    authFlow,
    writeFlow,
    commandHelpOpen,
    setCommandHelpOpen,
    availableCommands,
    handleCommandSubmit,
    handleCommandKeyDown,
    handleCommandHelpClick,
    getPromptLabel,
  } = useTerminal();

  // Focus the input whenever the page, auth mode, or write mode changes.
  useEffect(() => {
    commandInputRef.current?.focus();
  }, [page, authFlow, writeFlow]);

  // Focus when TerminalContext explicitly requests it (e.g. command-help fill).
  useEffect(() => {
    if (focusInputSignal > 0) {
      commandInputRef.current?.focus();
    }
  }, [focusInputSignal]);

  // Scroll the output panel to the bottom whenever new lines arrive.
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [terminalLines]);

  function handleCommandAreaClick(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (window.getSelection()?.toString()) return;
    if (target.closest("input, textarea, button")) return;
    commandInputRef.current?.focus();
  }

  return (
    <main className="terminal-page">
      <section
        className="terminal-window"
        aria-label="ft_transcendence terminal"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
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

        {/* ── Output log ─────────────────────────────────────────────────── */}
        <section className="terminal-output" aria-live="polite" ref={outputRef}>
          {terminalLines.map((line, index) => (
            <p key={`${line}-${index}`}>{line}</p>
          ))}
        </section>

        {/* ── Page content (routed) ───────────────────────────────────────── */}
        <section className="terminal-body">
          <Routes>
            <Route path="/" element={<WelcomePage />} />
            <Route path="/menu" element={<HomePage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/users/show" element={<UsersPage />} />
            <Route path="/users/show/:id" element={<UserDetailPage />} />
            <Route path="/friends/show" element={<FriendsPage />} />
            <Route path="/users/login" element={<LoginPage />} />
            <Route path="/users/create" element={<RegisterPage />} />
            <Route
              path="/users/me"
              element={<ProfilePage key={sessionUser?.id ?? "guest"} />}
            />
            <Route path="/discussions/show" element={<DiscussionsPage />} />
            <Route
              path="/discussions/show/:id"
              element={<DiscussionDetailPage />}
            />
            <Route path="/mail/show" element={<MailPage />} />
            <Route path="/mail/show/:id" element={<MailDetailPage />} />
            <Route path="/games/show" element={<GamesPage />} />
            <Route
              path="/games/play/:id"
              element={<GamePlayPage game={selectedGame} />}
            />
          </Routes>
        </section>

        {/* ── Footer / command input ──────────────────────────────────────── */}
        <footer className="terminal-footer">
          <pre className="ascii-rule" aria-hidden="true">
            ----------------------------------------------------
          </pre>
          <p>
            available: <span>{availableCommands.join(" | ")}</span>
          </p>
          <form
            onSubmit={handleCommandSubmit}
            className="command-form"
            onClick={handleCommandAreaClick}
          >
            <label htmlFor="command-input">{getPromptLabel()}</label>
            <input
              id="command-input"
              value={commandInput}
              ref={commandInputRef}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={handleCommandKeyDown}
              autoComplete="off"
              autoFocus
            />
          </form>
        </footer>
      </section>

      {/* ── Command help popover ──────────────────────────────────────────── */}
      <div className={`command-help ${commandHelpOpen ? "open" : ""}`}>
        {commandHelpOpen && (
          <div
            className="command-help-popover"
            role="menu"
            aria-label="Available commands"
          >
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
          onClick={() => setCommandHelpOpen((open) => !open)}
        >
          ?
        </button>
      </div>
    </main>
  );
}
