// The translation machinery: the language list, the dictionaries, and the t()
// function the whole UI calls.
//
// Keys are the English strings themselves, so an untranslated key still renders
// as readable English — which is also why the `en` dictionary is empty.

import { createContext, useContext } from "react";
import { cs } from "./locales/cs";
import { sl } from "./locales/sl";

export type Lang = "en" | "cs" | "sl";

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "cs", label: "Čeština" },
  { code: "sl", label: "Slovenščina" },
];

export const STORAGE_KEY = "ft_transcendence.lang";

// english has no entries: t() falls back to the key, and the keys are English
export const dictionaries: Record<Lang, Record<string, string>> = {
  en: {},
  cs,
  sl,
};

export type TranslateVars = Record<string, string | number>;
export type TranslateFn = (key: string, vars?: TranslateVars) => string;

export type I18nContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TranslateFn;
};

export const I18nContext = createContext<I18nContextValue | null>(null);

// fills in {placeholders}. an unknown name is left as-is rather than blanked,
// so a typo shows up in the UI instead of silently disappearing
export function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) => key in vars ? String(vars[key]) : `{${key}}`, );
}

// type guard, so a string from storage or from `lang <code>` can be trusted
export function isLang(value: string): value is Lang {
  return value === "en" || value === "cs" || value === "sl";
}

// the saved language, english when there's nothing valid stored
export function readLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && isLang(stored) ? stored : "en";
}

export function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
}
