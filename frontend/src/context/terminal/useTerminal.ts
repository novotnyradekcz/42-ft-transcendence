import { createContext, useContext } from "react";
import type { TerminalContextValue } from "./types";

export const TerminalContext = createContext<TerminalContextValue | null>(null);

export function useTerminal(): TerminalContextValue {
  const ctx = useContext(TerminalContext);
  if (!ctx)
    throw new Error("useTerminal must be used within a <TerminalProvider>");
  return ctx;
}
