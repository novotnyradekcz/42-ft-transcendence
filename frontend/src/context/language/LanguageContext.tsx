// Holds the chosen language and hands down the t() function built from it.
//
// The choice is remembered in localStorage — not sessionStorage like the login,
// since a language preference should outlive the session.

// the provider is kept apart from i18n.ts because fast refresh wants components
// and plain values in different files
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
  const [lang, setLangState] = useState<Lang>(() => readLang());

  // both halves of remembering it: the stored value the next visit reads back,
  // and the html lang attribute screen readers and the browser go by
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  // rebuilt only when the language changes — t() is passed to every component,
  // so a new identity each render would re-render all of them
  const value = useMemo<I18nContextValue>(() => {
    const dict = dictionaries[lang];
    const t: TranslateFn = (key, vars) => interpolate(dict[key] ?? key, vars);
    return { lang, setLang: setLangState, t };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
