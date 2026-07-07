/* eslint-disable react-refresh/only-export-components --
   This module is the i18n context provider plus its hook/constants; co-locating
   them is intentional. Fast Refresh only affects dev HMR, not correctness. */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "en" | "cs" | "sl";

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "cs", label: "Čeština" },
  { code: "sl", label: "Slovenščina" },
];

const STORAGE_KEY = "ft_transcendence.lang";

// Translations are keyed by the English source string. Anything missing falls
// back to the English key, so untranslated strings still render.
const cs: Record<string, string> = {
  // shell / header
  "ft_transcendence BBS ready.": "ft_transcendence BBS připraven.",
  "Type `menu` to enter.": "Napište `menu` pro vstup.",
  guest: "host",
  // section titles
  Welcome: "Vítejte",
  "Main Menu": "Hlavní nabídka",
  Help: "Nápověda",
  Users: "Uživatelé",
  User: "Uživatel",
  "User: {name}": "Uživatel: {name}",
  Friends: "Přátelé",
  Login: "Přihlášení",
  Register: "Registrace",
  Profile: "Profil",
  Discussions: "Diskuze",
  Discussion: "Diskuze",
  "Personal Mail": "Osobní pošta",
  Mail: "Pošta",
  Games: "Hry",
  // welcome / home
  "Type `menu` to enter the board.": "Napište `menu` pro vstup na nástěnku.",
  "Welcome {name}.":
    "Vítejte {name}.",
  "discussions - public posts and replies": "diskuze - veřejné příspěvky a odpovědi",
  "users - board member list": "uživatelé - seznam členů nástěnky",
  "friends - saved users and online status": "přátelé - uložení uživatelé a stav online",
  "mail - non-live personal messages": "pošta - osobní zprávy mimo živý chat",
  "games - empty for now": "hry - zatím prázdné",
  "logout - end this session": "odhlásit - ukončit toto sezení",
  "login / register - account access": "přihlásit / registrovat - přístup k účtu",
  // empty states
  "No users available.": "Žádní uživatelé nejsou k dispozici.",
  "No friends added yet.": "Zatím nebyli přidáni žádní přátelé.",
  "No games installed yet.": "Zatím nejsou nainstalovány žádné hry.",
  "No mail available. Log in to view your inbox.":
    "Žádná pošta. Přihlaste se pro zobrazení schránky.",
  "No user selected.": "Není vybrán žádný uživatel.",
  "No discussion selected.": "Není vybrána žádná diskuze.",
  "No message selected.": "Není vybrána žádná zpráva.",
  "Not logged in.": "Nepřihlášen.",
  // labels
  Name: "Jméno",
  Email: "E-mail",
  Status: "Stav",
  Bio: "Bio",
  From: "Od",
  To: "Komu",
  Title: "Předmět",
  "Avatar URL": "URL avataru",
  // buttons / status values
  "add friend": "přidat přítele",
  "remove friend": "odebrat přítele",
  friend: "přítel",
  online: "online",
  offline: "offline",
  "save profile": "uložit profil",
  "saved.": "uloženo.",
  "could not save profile.": "profil se nepodařilo uložit.",
  // login / register / profile copy
  "Login happens in the command input. Current prompt: {step}.":
    "Přihlášení probíhá v příkazovém řádku. Aktuální krok: {step}.",
  "Press Ctrl+C or Esc to quit login.":
    "Stiskněte Ctrl+C nebo Esc pro ukončení přihlášení.",
  "Register happens in the command input. Current prompt: {step}.":
    "Registrace probíhá v příkazovém řádku. Aktuální krok: {step}.",
  "Registration sends name, email, and password to `/users/create`.":
    "Registrace odešle jméno, e-mail a heslo na `/users/create`.",
  "Press Ctrl+C or Esc to quit register.":
    "Stiskněte Ctrl+C nebo Esc pro ukončení registrace.",
  idle: "nečinný",
  // footer / write status
  "available:": "dostupné:",
  "Press Ctrl+C or Esc to cancel.": "Stiskněte Ctrl+C nebo Esc pro zrušení.",
  "Writing new discussion. Current prompt: {step}.":
    "Píšete novou diskuzi. Aktuální krok: {step}.",
  "Writing reply. Enter the reply in the command line.":
    "Píšete odpověď. Zadejte odpověď do příkazového řádku.",
  "Writing mail. Current prompt: {step}.": "Píšete poštu. Aktuální krok: {step}.",
  "{count} posts": "{count} příspěvků",
  "sent to {name}": "odesláno uživateli {name}",
  "from {name}": "od uživatele {name}",
  // lang command
  "Switch the interface language.": "Přepnout jazyk rozhraní.",
  "Language set to {lang}.": "Jazyk nastaven na {lang}.",
  "Usage: lang <en|cs|sl>": "Použití: lang <en|cs|sl>",
  // log command
  "Show or hide the activity log below the page content.":
    "Zobrazit nebo skrýt log aktivity pod obsahem stránky.",
  "Log shown.": "Log zobrazen.",
  "Log hidden.": "Log skryt.",
  // command help submenu
  "‹ commands": "‹ příkazy",
  "No items to choose.": "Žádné položky k výběru.",
  // command descriptions
  "Show all available commands.": "Zobrazit všechny dostupné příkazy.",
  "Enter or return to the main board menu.": "Vstoupit nebo se vrátit do hlavní nabídky.",
  "Open the user list.": "Otevřít seznam uživatelů.",
  "Start command-line login.": "Spustit přihlášení v příkazovém řádku.",
  "Start command-line registration.": "Spustit registraci v příkazovém řádku.",
  "Show your current profile.": "Zobrazit váš aktuální profil.",
  "Open your friend list.": "Otevřít seznam přátel.",
  "Add a user as a friend from the current list or profile.":
    "Přidat uživatele jako přítele ze seznamu nebo profilu.",
  "Remove a user from your friend list.": "Odebrat uživatele ze seznamu přátel.",
  "Log out of the current account.": "Odhlásit se z aktuálního účtu.",
  "Open public discussion threads.": "Otevřít veřejná diskuzní vlákna.",
  "Open personal non-live mail.": "Otevřít osobní poštu mimo živý chat.",
  "Open the games section.": "Otevřít sekci her.",
  "Refresh the list for the current page.": "Obnovit seznam na aktuální stránce.",
  "Open an item from the current list.": "Otevřít položku z aktuálního seznamu.",
  "Start a command-line write flow where the current page supports it.":
    "Spustit psaní v příkazovém řádku tam, kde to stránka podporuje.",
  "Go back one level. Ctrl+C and Escape also do this.":
    "Vrátit se o úroveň zpět. Ctrl+C a Escape dělají totéž.",
};

const sl: Record<string, string> = {
  // shell / header
  "ft_transcendence BBS ready.": "ft_transcendence BBS pripravljen.",
  "Type `menu` to enter.": "Vnesite `menu` za vstop.",
  guest: "gost",
  // section titles
  Welcome: "Dobrodošli",
  "Main Menu": "Glavni meni",
  Help: "Pomoč",
  Users: "Uporabniki",
  User: "Uporabnik",
  "User: {name}": "Uporabnik: {name}",
  Friends: "Prijatelji",
  Login: "Prijava",
  Register: "Registracija",
  Profile: "Profil",
  Discussions: "Razprave",
  Discussion: "Razprava",
  "Personal Mail": "Osebna pošta",
  Mail: "Pošta",
  Games: "Igre",
  // welcome / home
  "Type `menu` to enter the board.": "Vnesite `menu` za vstop na tablo.",
  "Welcome {name}.":
    "Dobrodošli {name}.",
  "discussions - public posts and replies": "razprave - javne objave in odgovori",
  "users - board member list": "uporabniki - seznam članov table",
  "friends - saved users and online status":
    "prijatelji - shranjeni uporabniki in stanje povezave",
  "mail - non-live personal messages": "pošta - osebna sporočila brez živega klepeta",
  "games - empty for now": "igre - zaenkrat prazno",
  "logout - end this session": "odjava - končaj to sejo",
  "login / register - account access": "prijava / registracija - dostop do računa",
  // empty states
  "No users available.": "Ni razpoložljivih uporabnikov.",
  "No friends added yet.": "Še ni dodanih prijateljev.",
  "No games installed yet.": "Nameščenih iger še ni.",
  "No mail available. Log in to view your inbox.":
    "Ni pošte. Prijavite se za ogled nabiralnika.",
  "No user selected.": "Noben uporabnik ni izbran.",
  "No discussion selected.": "Nobena razprava ni izbrana.",
  "No message selected.": "Nobeno sporočilo ni izbrano.",
  "Not logged in.": "Niste prijavljeni.",
  // labels
  Name: "Ime",
  Email: "E-pošta",
  Status: "Stanje",
  Bio: "Opis",
  From: "Od",
  To: "Za",
  Title: "Naslov",
  "Avatar URL": "URL avatarja",
  // buttons / status values
  "add friend": "dodaj prijatelja",
  "remove friend": "odstrani prijatelja",
  friend: "prijatelj",
  online: "povezan",
  offline: "nepovezan",
  "save profile": "shrani profil",
  "saved.": "shranjeno.",
  "could not save profile.": "profila ni bilo mogoče shraniti.",
  // login / register / profile copy
  "Login happens in the command input. Current prompt: {step}.":
    "Prijava poteka v ukazni vrstici. Trenutni korak: {step}.",
  "Press Ctrl+C or Esc to quit login.":
    "Pritisnite Ctrl+C ali Esc za izhod iz prijave.",
  "Register happens in the command input. Current prompt: {step}.":
    "Registracija poteka v ukazni vrstici. Trenutni korak: {step}.",
  "Registration sends name, email, and password to `/users/create`.":
    "Registracija pošlje ime, e-pošto in geslo na `/users/create`.",
  "Press Ctrl+C or Esc to quit register.":
    "Pritisnite Ctrl+C ali Esc za izhod iz registracije.",
  idle: "nedejavno",
  // footer / write status
  "available:": "na voljo:",
  "Press Ctrl+C or Esc to cancel.": "Pritisnite Ctrl+C ali Esc za preklic.",
  "Writing new discussion. Current prompt: {step}.":
    "Pišete novo razpravo. Trenutni korak: {step}.",
  "Writing reply. Enter the reply in the command line.":
    "Pišete odgovor. Vnesite odgovor v ukazno vrstico.",
  "Writing mail. Current prompt: {step}.": "Pišete pošto. Trenutni korak: {step}.",
  "{count} posts": "{count} objav",
  "sent to {name}": "poslano uporabniku {name}",
  "from {name}": "od uporabnika {name}",
  // lang command
  "Switch the interface language.": "Preklopi jezik vmesnika.",
  "Language set to {lang}.": "Jezik nastavljen na {lang}.",
  "Usage: lang <en|cs|sl>": "Uporaba: lang <en|cs|sl>",
  // log command
  "Show or hide the activity log below the page content.":
    "Prikaži ali skrij dnevnik dejavnosti pod vsebino strani.",
  "Log shown.": "Dnevnik prikazan.",
  "Log hidden.": "Dnevnik skrit.",
  // command help submenu
  "‹ commands": "‹ ukazi",
  "No items to choose.": "Ni elementov za izbiro.",
  // command descriptions
  "Show all available commands.": "Prikaži vse razpoložljive ukaze.",
  "Enter or return to the main board menu.": "Vstopi ali se vrni v glavni meni.",
  "Open the user list.": "Odpri seznam uporabnikov.",
  "Start command-line login.": "Začni prijavo v ukazni vrstici.",
  "Start command-line registration.": "Začni registracijo v ukazni vrstici.",
  "Show your current profile.": "Prikaži vaš trenutni profil.",
  "Open your friend list.": "Odpri seznam prijateljev.",
  "Add a user as a friend from the current list or profile.":
    "Dodaj uporabnika kot prijatelja s seznama ali profila.",
  "Remove a user from your friend list.": "Odstrani uporabnika s seznama prijateljev.",
  "Log out of the current account.": "Odjavi se iz trenutnega računa.",
  "Open public discussion threads.": "Odpri javne teme razprav.",
  "Open personal non-live mail.": "Odpri osebno pošto brez živega klepeta.",
  "Open the games section.": "Odpri razdelek iger.",
  "Refresh the list for the current page.": "Osveži seznam za trenutno stran.",
  "Open an item from the current list.": "Odpri element s trenutnega seznama.",
  "Start a command-line write flow where the current page supports it.":
    "Začni pisanje v ukazni vrstici, kjer stran to podpira.",
  "Go back one level. Ctrl+C and Escape also do this.":
    "Pojdi en nivo nazaj. Ctrl+C in Escape naredita enako.",
};

const dictionaries: Record<Lang, Record<string, string>> = { en: {}, cs, sl };

type TranslateVars = Record<string, string | number>;
type TranslateFn = (key: string, vars?: TranslateVars) => string;

type I18nContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TranslateFn;
  languages: typeof LANGUAGES;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}

export function isLang(value: string): value is Lang {
  return value === "en" || value === "cs" || value === "sl";
}

function readLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && isLang(stored) ? stored : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readLang());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nContextValue>(() => {
    const dict = dictionaries[lang];
    const t: TranslateFn = (key, vars) => interpolate(dict[key] ?? key, vars);
    return { lang, setLang: setLangState, t, languages: LANGUAGES };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
}
