// The status context object and its hook, split from StatusContext.tsx for the
// same fast-refresh reason as the others.

import { createContext, useContext } from "react";
import type { StatusContextValue } from "./types";

export const StatusContext = createContext<StatusContextValue | null>(null);

// throws outside a provider rather than returning null, which would read as
// "nobody is online" and be much harder to spot
export function useStatus(): StatusContextValue {
  const ctx = useContext(StatusContext);
  if (!ctx)
    throw new Error("useStatus must be used within a <StatusProvider>");
  return ctx;
}
