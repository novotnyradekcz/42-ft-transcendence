// kept separate from i18n.ts because fast refresh needs components
// and non-components in different files

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  I18nContext,
  STORAGE_KEY,
  dictionaries,
  interpolate,
  readLang,
  type I18nContextValue,
  type Lang,
  type TranslateFn,
} from "./i18n";

export function LanguageProvider({ children }: { children: ReactNode }) {
  // start with saved language
  const [lang, setLangState] = useState<Lang>(() => readLang());

  // save language and update html lang attribute
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  // only recompute when lang changes
  const value = useMemo<I18nContextValue>(() => {
    const dict = dictionaries[lang];
    const t: TranslateFn = (key, vars) => interpolate(dict[key] ?? key, vars);
    return { lang, setLang: setLangState, t };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
