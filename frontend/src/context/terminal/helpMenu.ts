// second layer of the ? menu: the values a command can be completed with.
// commands that take an argument used to just prefill the prompt and leave the
// user to type the number, which meant reading it off the page first.
import { fetchOAuthProviders } from "../../api";
import { baseCommand } from "../../commands";
import { LANGUAGES } from "../language/i18n";
import type { TerminalDeps } from "./deps";

// one pickable value, `value` is what gets appended to the command
export type HelpOption = { value: string; label: string };

export type HelpSubmenu = {
  // bare command the picked value completes, e.g. "enter"
  command: string;
  // label of the row that opened it, shown on the back button
  title: string;
  options: HelpOption[];
  // oauth fetches its providers, the others are already in memory
  loading: boolean;
};

// commands whose argument the menu can enumerate
const LIST_COMMANDS = ["lang", "enter", "addfriend", "removefriend"];

export function opensSubmenu(commandLabel: string): boolean {
  const name = baseCommand(commandLabel);
  // the provider list is fetched, so its label carries no <placeholder>
  if (name === "oauth") return true;
  // bare `addfriend`/`removefriend` on a user page act on the user already
  // open — there is nothing to choose
  if (!commandLabel.includes("<")) return false;
  return LIST_COMMANDS.includes(name);
}

// numbers match the page's numbered list, so "03" here is "[03]" there
function numbered<T>(items: T[], label: (item: T) => string): HelpOption[] {
  return items.map((item, index) => ({
    value: String(index + 1),
    label: `${String(index + 1).padStart(2, "0")}  ${label(item)}`,
  }));
}

// what `enter` would open depends on the list the current page is showing
function enterOptions(deps: TerminalDeps): HelpOption[] {
  const { page, knownUsers, friends, discussions, mail, games } = deps;
  if (page === "users") return numbered(knownUsers, (user) => user.name);
  if (page === "friends") return numbered(friends, (user) => user.name);
  if (page === "discussions") return numbered(discussions, (d) => d.name);
  if (page === "mail") return numbered(mail, (message) => message.title);
  if (page === "games") return numbered(games, (game) => game.name);
  return [];
}

export function buildSubmenu(
  commandLabel: string,
  deps: TerminalDeps,
): HelpSubmenu {
  const command = baseCommand(commandLabel);
  const base = { command, title: commandLabel, loading: false };

  if (command === "lang") {
    return {
      ...base,
      options: LANGUAGES.map((language) => ({
        value: language.code,
        label: `${language.code}  ${language.label}`,
      })),
    };
  }

  if (command === "enter") {
    return { ...base, options: enterOptions(deps) };
  }

  if (command === "addfriend" || command === "removefriend") {
    // same source resolveFriendTarget() indexes into, so the numbers agree
    const source = deps.page === "friends" ? deps.friends : deps.knownUsers;
    return { ...base, options: numbered(source, (user) => user.name) };
  }

  // oauth, filled in by loadOAuthOptions once the request lands
  return { ...base, options: [], loading: true };
}

export async function loadOAuthOptions(): Promise<HelpOption[]> {
  const providers = await fetchOAuthProviders();
  return providers.map((provider) => ({
    value: provider.id,
    label: provider.label,
  }));
}
