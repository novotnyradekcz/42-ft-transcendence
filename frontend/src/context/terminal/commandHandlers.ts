import {
  addFriend as apiAddFriend,
  getDiscussion,
  getMail,
  getUser,
  getUserByName,
  removeFriend as apiRemoveFriend,
} from "../../api";
import {
  commandDefinitions,
  isCommand,
  parseCommand,
} from "../../commands";
import { isLang, LANGUAGES } from "../language/i18n";
import { PAGE_PATHS } from "../../router";
import type { TerminalDeps } from "./deps";
import { errMsg } from "./helpers";

export function createCommandHandlers(
  deps: TerminalDeps,
  handleWriteCommand: () => void,
) {
  const {
    page,
    sessionUser,
    knownUsers,
    discussions,
    mail,
    friends,
    games,
    selectedUser,
    setSelectedUser,
    setSelectedMail,
    setSelectedDiscussion,
    setSelectedGame,
    setAuthFlow,
    setAuthError,
    setCommandHelpOpen,
    addLine,
    t,
    setLang,
    navigate,
    goTo,
    goBack,
    clearWriteModes,
    refreshBoard,
    contextLogout,
    updateSessionUser,
    refreshUsers,
  } = deps;

  async function executeCommand(rawInput: string, echo = true) {
    setCommandHelpOpen(false);
    if (echo) addLine(`> ${rawInput}`);

    const { name, args } = parseCommand(rawInput);
    const definition = commandDefinitions.find((cmd) => isCommand(name, cmd));
    const command = definition?.command;

    if (!command) {
      addLine(t("unknown command: {name}", { name }));
      return;
    }

    if (page === "welcome" && command !== "menu") {
      addLine(t("type `menu` to enter."));
      return;
    }

    if (command === "lang") {
      const code = (args[0] ?? "").toLowerCase();
      if (!args[0]) {
        addLine(
          t("Available languages: {langs}", {
            langs: LANGUAGES.map((language) => language.code).join(", "),
          }),
        );
      } else if (isLang(code)) {
        setLang(code);
        addLine(t("Language set to {lang}.", { lang: code }));
      } else {
        addLine(t("Usage: lang <en|cs|sl>"));
      }
      return;
    }

    if (command === "help") {
      goTo(PAGE_PATHS.help);
      return;
    }

    if (command === "menu") {
      clearWriteModes();
      navigate(PAGE_PATHS.home);
      return;
    }

    if (command === "back") {
      goBack();
      return;
    }

    if (command === "list") {
      const errors = await refreshBoard();
      errors.forEach(addLine);
      if (errors.length === 0) addLine(t("refreshed {page}.", { page }));
      return;
    }

    if (command === "logout") {
      contextLogout();
      setSelectedMail(null);
      setSelectedUser(null);
      navigate(PAGE_PATHS.home);
      addLine(t("logged out."));
      return;
    }

    if (command === "write") {
      handleWriteCommand();
      return;
    }
    if (command === "enter") {
      await handleEnterCommand(args[0]);
      return;
    }

    if (command === "addfriend" || command === "removefriend") {
      await handleFriendCommand(command, args[0]);
      return;
    }

    if (command === "login") {
      if (sessionUser) {
        addLine(t("already logged in. use logout first."));
        return;
      }
      setAuthFlow({ mode: "login", step: "name", name: "" });
      setAuthError("");
      goTo(PAGE_PATHS.login);
      addLine(t("login started. enter name."));
      return;
    }

    if (command === "register") {
      if (sessionUser) {
        addLine(t("already logged in. use logout first."));
        return;
      }
      setAuthFlow({ mode: "register", step: "name", name: "", email: "" });
      setAuthError("");
      goTo(PAGE_PATHS.register);
      addLine(t("register started. enter name."));
      return;
    }

    const directPaths: Partial<Record<string, string>> = {
      users: PAGE_PATHS.users,
      friends: PAGE_PATHS.friends,
      profile: PAGE_PATHS.profile,
      discussions: PAGE_PATHS.discussions,
      mail: PAGE_PATHS.mail,
      games: PAGE_PATHS.games,
    };

    const nextPath = directPaths[command];

    if ((command === "profile" || command === "friends") && !sessionUser) {
      addLine(
        command === "profile"
          ? t("login first to view your profile.")
          : t("login first to view friends."),
      );
      setAuthFlow({ mode: "login", step: "name", name: "" });
      setAuthError("");
      goTo(PAGE_PATHS.login);
      return;
    }

    if (nextPath) {
      const errors = await refreshBoard();
      errors.forEach(addLine);
      goTo(nextPath);
    }
  }

  async function handleEnterCommand(indexValue?: string) {
    const index = Number(indexValue) - 1;
    if (!indexValue || Number.isNaN(index) || index < 0) {
      addLine(t("usage: enter <number>"));
      return;
    }

    if (page === "users") {
      const user = knownUsers[index];
      if (!user) {
        addLine(t("no user exists at that number."));
        return;
      }
      try {
        setSelectedUser(await getUser(user.id));
        navigate(`/users/show/${user.id}`);
      } catch (e) {
        addLine(errMsg(e, t("could not load user.")));
      }
      return;
    }

    if (page === "discussions") {
      const discussion = discussions[index];
      if (!discussion) {
        addLine(t("no discussion exists at that number."));
        return;
      }
      try {
        setSelectedDiscussion(await getDiscussion(discussion.id));
        navigate(`/discussions/show/${discussion.id}`);
      } catch (e) {
        addLine(errMsg(e, t("could not load discussion.")));
      }
      return;
    }

    if (page === "mail") {
      const message = mail[index];
      if (!message) {
        addLine(t("no mail exists at that number."));
        return;
      }
      try {
        setSelectedMail(await getMail(message.id));
        navigate(`/mail/show/${message.id}`);
      } catch (e) {
        addLine(errMsg(e, t("could not load mail.")));
      }
      return;
    }

    if (page === "friends") {
      const user = friends[index];
      if (!user) {
        addLine(t("no friend exists at that number."));
        return;
      }
      try {
        setSelectedUser(await getUser(user.id));
        navigate(`/users/show/${user.id}`);
      } catch (e) {
        addLine(errMsg(e, t("could not load user.")));
      }
      return;
    }

    if (page === "games") {
      const selected = games[index];
      if (!selected) {
        addLine(t("no game exists at that number."));
        return;
      }
      if (!sessionUser) {
        addLine(t("login first to play games."));
        setAuthFlow({ mode: "login", step: "name", name: "" });
        setAuthError("");
        goTo(PAGE_PATHS.login);
        return;
      }
      setSelectedGame(selected);
      navigate(`/games/play/${selected.id}`);
      return;
    }

    addLine(t("enter is not available on this page."));
  }

  async function handleFriendCommand(
    action: "addfriend" | "removefriend",
    targetValue?: string,
  ) {
    if (!sessionUser) {
      addLine(t("login first to manage friends."));
      setAuthFlow({ mode: "login", step: "name", name: "" });
      setAuthError("");
      goTo(PAGE_PATHS.login);
      return;
    }

    const target = await resolveFriendTarget(targetValue);
    if (!target) {
      addLine(t("usage: {action} <number|name>", { action }));
      return;
    }

    if (action === "addfriend") {
      await handleAddFriend(target.id);
    } else {
      await handleRemoveFriend(target.id);
    }
  }

  async function resolveFriendTarget(targetValue?: string) {
    if (!targetValue && page === "user-detail") return selectedUser;
    if (!targetValue) return null;
    const index = Number(targetValue) - 1;
    if (!Number.isNaN(index) && index >= 0) {
      const source = page === "friends" ? friends : knownUsers;
      return source[index] ?? null;
    }
    return getUserByName(targetValue).catch(() => null);
  }

  async function handleAddFriend(userId: number) {
    if (!sessionUser) return;
    try {
      await apiAddFriend(sessionUser.id, userId);
      updateSessionUser({
        ...sessionUser,
        friends: [...new Set([...sessionUser.friends, userId])],
      });
      const target = knownUsers.find((u) => u.id === userId);
      addLine(
        t("added {name} as friend.", {
          name: target?.name ?? `user#${userId}`,
        }),
      );
      await refreshUsers().catch(() => {});
    } catch (e) {
      addLine(errMsg(e, t("could not add friend.")));
    }
  }

  async function handleRemoveFriend(userId: number) {
    if (!sessionUser) return;
    try {
      await apiRemoveFriend(sessionUser.id, userId);
      updateSessionUser({
        ...sessionUser,
        friends: sessionUser.friends.filter((id) => id !== userId),
      });
      const target = knownUsers.find((u) => u.id === userId);
      addLine(
        t("removed {name} from friends.", {
          name: target?.name ?? `user#${userId}`,
        }),
      );
      await refreshUsers().catch(() => {});
    } catch (e) {
      addLine(errMsg(e, t("could not remove friend.")));
    }
  }

  return { executeCommand };
}
