import type { CommandDefinition, Page } from "./types";

export const commandDefinitions: CommandDefinition[] = [
  {
    command: "help",
    aliases: ["?", "h"],
    usage: "help",
    description: "Show all available commands.",
  },
  {
    command: "menu",
    aliases: ["home", "me"],
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
    aliases: ["logi"],
    usage: "login",
    description: "Start command-line login.",
  },
  {
    command: "register",
    aliases: ["r", "reg"],
    usage: "register",
    description: "Start command-line registration.",
  },
  {
    command: "profile",
    aliases: ["p"],
    usage: "profile",
    description: "Show your current profile.",
  },
  {
    command: "friends",
    aliases: ["f"],
    usage: "friends",
    description: "Open your friend list.",
  },
  {
    command: "addfriend",
    aliases: ["friend", "af"],
    usage: "addfriend 1",
    description: "Add a user as a friend from the current list or profile.",
  },
  {
    command: "removefriend",
    aliases: ["unfriend", "rf"],
    usage: "removefriend 1",
    description: "Remove a user from your friend list.",
  },
  {
    command: "logout",
    aliases: ["logo"],
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
    aliases: ["li"],
    usage: "list",
    description: "Refresh the list for the current page.",
  },
  {
    command: "enter",
    aliases: ["open", "e"],
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
    aliases: ["cancel", "ctrl+c", "esc", "b"],
    usage: "back",
    description: "Go back one level. Ctrl+C and Escape also do this.",
  },
];

const pageCommands: Record<Page, string[]> = {
  welcome: ["menu"],
  home: [
    "help",
    "users",
    "login",
    "register",
    "logout",
    "profile",
    "friends",
    "discussions",
    "mail",
    "games",
  ],
  help: ["menu", "back"],
  users: ["list", "enter <number>", "addfriend <number>", "menu", "back"],
  "user-detail": ["addfriend", "removefriend", "users", "menu", "back"],
  friends: ["list", "enter <number>", "removefriend <number>", "menu", "back"],
  login: ["Ctrl+C", "Esc"],
  register: ["Ctrl+C", "Esc"],
  profile: ["friends", "logout", "menu", "back"],
  discussions: ["list", "enter <number>", "write", "menu", "back"],
  "discussion-detail": ["write", "discussions", "menu", "back"],
  mail: ["list", "enter <number>", "write", "menu", "back"],
  "mail-detail": ["mail", "menu", "back"],
  games: ["menu", "back"],
};

export function getAvailableCommands(page: Page, isLoggedIn = false): string[] {
  const commands = pageCommands[page];

  if (page === "home") {
    if (isLoggedIn) {
      return commands.filter((command) => command !== "login" && command !== "register");
    }

    return commands.filter((command) => command !== "logout");
  }

  if (isLoggedIn) {
    return commands;
  }

  return commands.filter(
    (command) => !command.startsWith("addfriend") && !command.startsWith("removefriend"),
  );
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
