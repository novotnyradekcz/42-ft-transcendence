import { createContext, useContext } from "react";
import { cs } from "./locales/cs";
import { sl } from "./locales/sl";

// supported languages
export type Lang = "en" | "cs" | "sl";

// languages for the picker
export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "cs", label: "Čeština" },
  { code: "sl", label: "Slovenščina" },
];

// localStorage key for saved language
export const STORAGE_KEY = "ft_transcendence.lang";

// export dictionaries, english empty because it's the default
export const dictionaries: Record<Lang, Record<string, string>> = {
  en: {},
  cs,
  sl,
};

// vars to fill in translation placeholders
export type TranslateVars = Record<string, string | number>;
// translation function type
export type TranslateFn = (key: string, vars?: TranslateVars) => string;

// shape of the i18n context
export type I18nContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TranslateFn;
  languages: typeof LANGUAGES;
};

// context for language state
export const I18nContext = createContext<I18nContextValue | null>(null);

// fills in {placeholders} with vars
export function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) => key in vars ? String(vars[key]) : `{${key}}`, );
}

// simple check if lang is valid
export function isLang(value: string): value is Lang {
  return value === "en" || value === "cs" || value === "sl";
}

// gets saved language, defaults to english
export function readLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && isLang(stored) ? stored : "en";
}

// hook to access i18n context
export function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
}
