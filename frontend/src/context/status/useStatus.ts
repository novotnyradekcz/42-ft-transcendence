import { createContext, useContext } from "react";
import type { StatusContextValue } from "./types";

export const StatusContext = createContext<StatusContextValue | null>(null);

export function useStatus(): StatusContextValue {
  const ctx = useContext(StatusContext);
  if (!ctx)
    throw new Error("useStatus must be used within a <StatusProvider>");
  return ctx;
}
