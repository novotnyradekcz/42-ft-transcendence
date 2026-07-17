import Terminal from "./components/Terminal";

/**
 * App is intentionally thin — all state lives in the three context providers
 * (SessionProvider, DataProvider, TerminalProvider) mounted in main.tsx.
 * The Terminal component owns the full UI and routes.
 */
export default function App() {
  return <Terminal />;
}
