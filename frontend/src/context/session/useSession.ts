// The session context object and its hook. Separate from SessionContext.tsx so
// that file can export only a component, which is what fast refresh needs.

import { createContext, useContext } from "react";
import type { SessionContextValue } from "./types";

export const SessionContext = createContext<SessionContextValue | null>(null);

// throws rather than returning null, so a component used outside the provider
// fails at once instead of quietly rendering as a guest
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a <SessionProvider>");
  }
  return ctx;
}
