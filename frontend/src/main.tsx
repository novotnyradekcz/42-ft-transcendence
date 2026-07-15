import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { LanguageProvider } from "./context/language/LanguageContext.tsx";
import { DataProvider } from "./context/data/DataContext.tsx";
import { SessionProvider } from "./context/session/SessionContext.tsx";
import { TerminalProvider } from "./context/terminal/TerminalContext.tsx";
import "./index.css";

/**
 * Provider hierarchy (outermost → innermost):
 *
 *   BrowserRouter        — React Router (needed by TerminalContext hooks)
 *   SessionProvider      — auth, credentials, knownUsers
 *   DataProvider         — resource data (discussions, mail, games, selected items)
 *   TerminalProvider     — command UI state + execution (uses Session + Data)
 *   App → Terminal       — renders the full BBS UI and <Routes>
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <BrowserRouter>
        <SessionProvider>
          <DataProvider>
            <TerminalProvider>
              <App />
            </TerminalProvider>
          </DataProvider>
        </SessionProvider>
      </BrowserRouter>
    </LanguageProvider>
  </StrictMode>,
);
