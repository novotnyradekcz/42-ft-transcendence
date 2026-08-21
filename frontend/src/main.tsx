// Entry point: mounts React and wraps the app in the five providers.
//
// The nesting order below is the dependency order — each provider uses the ones
// outside it — so it reads as indentation but isn't decoration. Language has no
// dependencies, Session says who is signed in, Status opens the online socket
// for that session, Data loads the board for it, and Terminal drives commands
// against all of them.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { LanguageProvider } from "./context/language/LanguageContext.tsx";
import { DataProvider } from "./context/data/DataContext.tsx";
import { StatusProvider } from "./context/status/StatusContext.tsx";
import { SessionProvider } from "./context/session/SessionContext.tsx";
import { TerminalProvider } from "./context/terminal/TerminalContext.tsx";
import "./index.css";

// BrowserRouter sits inside LanguageProvider because the pages read both,
// but only the routed pages need a router
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <BrowserRouter>
        <SessionProvider>
          <StatusProvider>
            <DataProvider>
              <TerminalProvider>
                <App />
              </TerminalProvider>
            </DataProvider>
          </StatusProvider>
        </SessionProvider>
      </BrowserRouter>
    </LanguageProvider>
  </StrictMode>,
);
