import { useEffect, useRef, type MouseEvent } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useData } from "../context/data/useData";
import { useSession } from "../context/session/useSession";
import { useTerminal } from "../context/terminal/useTerminal";
import { useTranslation } from "../context/language/i18n";
import { pageFromPath } from "../router";
import GamePlayPage from "../pages/GamePlayPage";
import DiscussionDetailPage from "../pages/DiscussionDetailPage";
import DiscussionsPage from "../pages/DiscussionsPage";
import FriendsPage from "../pages/FriendsPage";
import GamesPage from "../pages/GamesPage";
import HelpPage from "../pages/HelpPage";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import PrivacyPage from "../pages/PrivacyPage";
import TermsPage from "../pages/TermsPage";
import MailDetailPage from "../pages/MailDetailPage";
import MailPage from "../pages/MailPage";
import ProfilePage from "../pages/ProfilePage";
import RegisterPage from "../pages/RegisterPage";
import UserDetailPage from "../pages/UserDetailPage";
import UsersPage from "../pages/UsersPage";
import WelcomePage from "../pages/WelcomePage";
export default function Terminal() {
  const commandInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLElement>(null);

  const location = useLocation();
  const page = pageFromPath(location.pathname);

  const { sessionUser, isHydrating } = useSession();
  // selectedGame needed by GamePlayPage route
  const { selectedGame } = useData();
  const { t } = useTranslation();

  const {
    commandInput,
    setCommandInput,
    terminalLines,
    focusInputSignal,
    logVisible,
    authFlow,
    writeFlow,
    commandHelpOpen,
    toggleCommandHelp,
    helpSubmenu,
    availableCommands,
    isBusy,
    handleCommandSubmit,
    handleCommandKeyDown,
    handleCommandHelpClick,
    handleCommandHelpSelect,
    closeCommandHelpSubmenu,
    getPromptLabel,
  } = useTerminal();

  // focus the input whenever the page or an input mode changes
  useEffect(() => {
    commandInputRef.current?.focus();
  }, [page, authFlow, writeFlow]);

  // focus when the terminal context asks for it
  useEffect(() => {
    if (focusInputSignal > 0) {
      commandInputRef.current?.focus();
    }
  }, [focusInputSignal]);

  // the log sits at the bottom of the body, so scroll it to keep it in view
  useEffect(() => {
    if (logVisible && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [terminalLines, logVisible]);

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
        {/* ── Header (pinned) ────────────────────────────────────────────── */}
        <header className="terminal-header">
          <pre className="bbs-banner" aria-label="ft_transcendence banner">
            {String.raw`+--------------------------------------------------+
|              FT_TRANSCENDENCE BBS               |
+--------------------------------------------------+`}
          </pre>
        </header>

        {/* ── Page content (routed) — the only scrolling region ───────────── */}
        <section className="terminal-body" ref={bodyRef}>
          {/*
            Two route tables, not one guarded table: without a session the
            board pages are never mounted at all, so a typed URL, a bookmark
            or the browser Back button cannot reach them. Anything else a
            guest asks for falls through to the front page.

            Neither renders while hydrating: the guest catch-all replaces the
            URL, so picking it too early throws away where the user was going.
          */}
          {isHydrating ? null : sessionUser ? (
            <Routes>
              <Route path="/" element={<WelcomePage />} />
              <Route path="/menu" element={<HomePage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/users/show" element={<UsersPage />} />
              <Route path="/users/show/:id" element={<UserDetailPage />} />
              <Route path="/friends/show" element={<FriendsPage />} />
              <Route path="/users/login" element={<LoginPage />} />
              <Route path="/users/create" element={<RegisterPage />} />
              <Route
                path="/users/me"
                element={<ProfilePage key={sessionUser.id} />}
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
              {/* Members get the board root for anything unrecognised. Without
                  this the table simply matched nothing and rendered an empty
                  body under a working prompt. */}
              <Route path="*" element={<Navigate to="/menu" replace />} />
            </Routes>
          ) : (
            <Routes>
              <Route path="/" element={<WelcomePage />} />
              <Route path="/help" element={<HelpPage />} />
              {/* guests must be able to read what they're agreeing to */}
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/users/login" element={<LoginPage />} />
              <Route path="/users/create" element={<RegisterPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}

          {/* Activity log — hidden by default, toggled by the `log` command. */}
          {logVisible && (
            <section className="terminal-output" aria-live="polite">
              <pre className="ascii-rule" aria-hidden="true">
----------------------------------------------------
              </pre>
              {terminalLines.map((line, index) => (
                <p key={`${line}-${index}`}>{line}</p>
              ))}
            </section>
          )}
        </section>

        {/* ── Footer / command input (pinned) ─────────────────────────────── */}
        <footer className="terminal-footer">
          <pre className="ascii-rule" aria-hidden="true">
            ----------------------------------------------------
          </pre>
          {/* Newest log line, so commands still report back while the log is
              hidden — replaced by a progress line while a request is running,
              so a slow login does not read as a frozen prompt. */}
          <p
            className={`terminal-status ${isBusy ? "busy" : ""}`}
            aria-live="polite"
          >
            {isBusy ? t("loading...") : terminalLines[terminalLines.length - 1]}
          </p>
          <p>
            {t("available:")} <span>{availableCommands.join(" | ")}</span>
          </p>
          <form
            onSubmit={handleCommandSubmit}
            className="command-form"
            onClick={handleCommandAreaClick}
          >
            <label htmlFor="command-input">{getPromptLabel()}</label>
            {/* readOnly rather than disabled: it blocks typing mid-request
                without dropping focus, so the caret is still there when the
                answer lands. Ctrl+C and Esc keep working. */}
            {/* Masked on the password step of both login and register — the
                flows name that step identically, so one check covers both. */}
            <input
              id="command-input"
              value={commandInput}
              ref={commandInputRef}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={handleCommandKeyDown}
              type={authFlow?.step === "password" ? "password" : "text"}
              readOnly={isBusy}
              aria-busy={isBusy}
              autoComplete={
                authFlow?.step === "password" ? "current-password" : "off"
              }
              autoFocus
            />
          </form>
        </footer>
      </section>

      {/* ── Command help popover ──────────────────────────────────────────── */}
      {/* Two layers: the command list, and — for a command that takes a value
          — the values it can take, so the user picks a language or a list
          entry instead of reading a number off the page and typing it. */}
      <div className={`command-help ${commandHelpOpen ? "open" : ""}`}>
        {commandHelpOpen && (
          <div
            className="command-help-popover"
            role="menu"
            aria-label={
              helpSubmenu
                ? t("choices for {command}", { command: helpSubmenu.command })
                : t("available commands")
            }
          >
            {helpSubmenu ? (
              <>
                <button
                  type="button"
                  className="command-help-back"
                  onClick={closeCommandHelpSubmenu}
                >
                  {`< ${helpSubmenu.title}`}
                </button>
                {helpSubmenu.loading ? (
                  <p className="command-help-note">{t("loading...")}</p>
                ) : helpSubmenu.options.length === 0 ? (
                  <p className="command-help-note">{t("nothing to pick.")}</p>
                ) : (
                  helpSubmenu.options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        void handleCommandHelpSelect(option.value);
                      }}
                    >
                      {option.label}
                    </button>
                  ))
                )}
              </>
            ) : (
              availableCommands.map((command) => (
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
              ))
            )}
          </div>
        )}
        <button
          type="button"
          className="command-help-toggle"
          aria-label="Show available commands"
          aria-expanded={commandHelpOpen}
          onClick={toggleCommandHelp}
        >
          ?
        </button>
      </div>
    </main>
  );
}
