import type { CommandDefinition, Page } from "./types";

export const commandDefinitions: CommandDefinition[] = [
  {
    command: "help",
    aliases: ["?"],
    usage: "help",
    description: "Show all available commands.",
  },
  {
    command: "menu",
    aliases: ["home"],
    usage: "menu",
    description: "Enter or return to the main board menu.",
  },
  {
    command: "users",
    aliases: ["u"],
    usage: "users",
    description: "Open the user list.",
  },
  {
    command: "login",
    aliases: [],
    usage: "login",
    description: "Start command-line login.",
  },
  {
    command: "register",
    aliases: ["signup"],
    usage: "register",
    description: "Start command-line registration.",
  },
  {
    command: "profile",
    aliases: ["me"],
    usage: "profile",
    description: "Show your current profile.",
  },
  {
    command: "logout",
    aliases: [],
    usage: "logout",
    description: "Log out of the current account.",
  },
  {
    command: "discussions",
    aliases: ["d"],
    usage: "discussions",
    description: "Open public discussion threads.",
  },
  {
    command: "mail",
    aliases: ["m"],
    usage: "mail",
    description: "Open personal non-live mail.",
  },
  {
    command: "games",
    aliases: ["g"],
    usage: "games",
    description: "Open the games section.",
  },
  {
    command: "list",
    aliases: ["l"],
    usage: "list",
    description: "Refresh the list for the current page.",
  },
  {
    command: "enter",
    aliases: ["open"],
    usage: "enter 1",
    description: "Open an item from the current list.",
  },
  {
    command: "write",
    aliases: ["w"],
    usage: "write",
    description: "Start a command-line write flow where the current page supports it.",
  },
  {
    command: "back",
    aliases: ["cancel", "ctrl+c", "esc"],
    usage: "back",
    description: "Go back one level. Ctrl+C and Escape also do this.",
  },
  {
    command: "api",
    aliases: ["routes"],
    usage: "api",
    description: "Show the mock API route list for the backend teammate.",
  },
];

const pageCommands: Record<Page, string[]> = {
  welcome: ["menu"],
  home: ["help", "users", "login", "register", "logout", "profile", "discussions", "mail", "games", "api"],
  help: ["menu", "back"],
  users: ["list", "enter <number>", "menu", "back"],
  "user-detail": ["users", "menu", "back"],
  login: ["Ctrl+C", "Esc"],
  register: ["Ctrl+C", "Esc"],
  profile: ["logout", "menu", "back"],
  discussions: ["list", "enter <number>", "write", "menu", "back"],
  "discussion-detail": ["write", "discussions", "menu", "back"],
  mail: ["list", "enter <number>", "write", "menu", "back"],
  "mail-detail": ["mail", "menu", "back"],
  games: ["menu", "back"],
  api: ["menu", "back"],
};

export function getAvailableCommands(page: Page, isLoggedIn = false): string[] {
  if (page !== "home") {
    return pageCommands[page];
  }

  if (isLoggedIn) {
    return pageCommands.home.filter((command) => command !== "login" && command !== "register");
  }

  return pageCommands.home.filter((command) => command !== "logout");
}

export function parseCommand(input: string): { name: string; args: string[] } {
  const [name = "", ...args] = input.trim().split(/\s+/);
  return {
    name: name.toLowerCase(),
    args,
  };
}

export function isCommand(input: string, command: CommandDefinition): boolean {
  return command.command === input || command.aliases.includes(input);
}
