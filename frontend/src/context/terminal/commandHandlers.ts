import {
  addFriend as apiAddFriend,
  displayName,
  getDiscussion,
  getMail,
  getUser,
  getUserByName,
  removeFriend as apiRemoveFriend,
} from "../../api";
import {
  commandDefinitions,
  isCommand,
  isGuestCommand,
  parseCommand,
} from "../../commands";
import { isLang, LANGUAGES } from "../language/i18n";
import { PAGE_PATHS } from "../../router";
import type { TerminalDeps } from "./deps";
import { errMsg } from "../../errors";
import { startLoginFlow } from "./helpers";

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
    logVisible,
    setLogVisible,
    addLine,
    t,
    setLang,
    navigate,
    goTo,
    goBack,
    clearWriteModes,
    refreshForPage,
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

    // guests only get login and register until there's a session
    if (!sessionUser) {
      if (!isGuestCommand(command)) {
        addLine(t("type `login` or `register` to enter."));
        return;
      }
    } else if (page === "welcome" && command !== "menu") {
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

    if (command === "log") {
      const nextVisible = !logVisible;
      setLogVisible(nextVisible);
      addLine(nextVisible ? t("Log shown.") : t("Log hidden."));
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
      // refresh what this page shows, not every collection in the app
      const errors = await refreshForPage(page);
      errors.forEach(addLine);
      if (errors.length === 0) addLine(t("refreshed {page}.", { page }));
      return;
    }

    if (command === "logout") {
      contextLogout();
      setSelectedMail(null);
      setSelectedUser(null);
      // back to the guest front page, the board went with the session
      navigate(PAGE_PATHS.welcome);
      addLine(t("logged out."));
      return;
    }

    if (command === "write") {
      handleWriteCommand();
      return;
    }
    if (command === "upload") {
      if (!sessionUser) {
        addLine(t("login first to upload games."));
        startLoginFlow(deps);
        return;
      }
      if (page !== "games") {
        goTo(PAGE_PATHS.games);
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("trigger-game-upload"));
        }, 0);
        return;
      }
      window.dispatchEvent(new CustomEvent("trigger-game-upload"));
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
      startLoginFlow(deps);
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
      startLoginFlow(deps);
      return;
    }

    if (nextPath) {
      // go straight there. TerminalContext loads what the destination needs
      // once it's on screen, so navigation never waits on the network.
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
        startLoginFlow(deps);
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
      startLoginFlow(deps);
      return;
    }

    const target = await resolveFriendTarget(targetValue);
    if (!target) {
      addLine(t("usage: {action} <number|name>", { action }));
      return;
    }

    await applyFriendChange(action, target.id);
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

  // shared path for addfriend and removefriend, they only differ in the call
  async function applyFriendChange(
    action: "addfriend" | "removefriend",
    userId: number,
  ) {
    if (!sessionUser) return;
    const adding = action === "addfriend";
    try {
      await (adding ? apiAddFriend : apiRemoveFriend)(sessionUser.id, userId);
      updateSessionUser({
        ...sessionUser,
        friends: adding
          ? [...new Set([...sessionUser.friends, userId])]
          : sessionUser.friends.filter((id) => id !== userId),
      });
      const name = displayName(userId, knownUsers);
      addLine(
        adding
          ? t("added {name} as friend.", { name })
          : t("removed {name} from friends.", { name }),
      );
      await refreshUsers().catch(() => {});
    } catch (e) {
      addLine(
        errMsg(
          e,
          adding ? t("could not add friend.") : t("could not remove friend."),
        ),
      );
    }
  }

  return { executeCommand };
}
