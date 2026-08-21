// The data context object and its hook, split from DataContext.tsx so that file
// exports only a component.

import { createContext, useContext } from "react";
import type { DataContextValue } from "./types";

export const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within a <DataProvider>");
  return ctx;
}
