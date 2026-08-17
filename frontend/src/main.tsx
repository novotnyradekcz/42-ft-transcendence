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

// provider order matters, each one below depends on the ones above it
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
