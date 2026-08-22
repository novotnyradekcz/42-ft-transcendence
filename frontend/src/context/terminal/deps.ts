// The one object the three handler modules are given.
//
// They're plain factory functions rather than components, so they can't use
// hooks — everything they need is collected here instead. TerminalContext
// rebuilds it on every render, which is what keeps the closures they return
// from reading stale state.

import type { Dispatch, SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { TranslateFn, Lang } from "../language/i18n";
import type { AuthFlow, WriteFlow } from "../../terminalTypes";
import type {
  DiscussionThread,
  GameSummary,
  MailMessage,
  Page,
  SessionUser,
  UserProfile,
} from "../../types";

// everything the handler factories need from the provider
// rebuilt every render, so the returned closures always see fresh values
export interface TerminalDeps {
  page: Page;

  // session
  sessionUser: SessionUser | null;
  knownUsers: UserProfile[];
  login: (name: string, password: string) => Promise<SessionUser>;
  register: (
    name: string,
    email: string,
    password: string,
  ) => Promise<SessionUser>;
  contextLogout: () => void;
  updateSessionUser: (user: SessionUser) => void;
  refreshUsers: () => Promise<void>;
  refreshSessionUser: () => Promise<SessionUser | null>;

  // data
  discussions: DiscussionThread[];
  mail: MailMessage[];
  games: GameSummary[];
  friends: UserProfile[];
  selectedDiscussion: DiscussionThread | null;
  selectedUser: UserProfile | null;
  setSelectedDiscussion: (d: DiscussionThread | null) => void;
  setSelectedMail: (m: MailMessage | null) => void;
  setSelectedGame: (g: GameSummary | null) => void;
  setSelectedUser: (u: UserProfile | null) => void;
  ensureForPage: (page: Page) => Promise<string[]>;
  refreshForPage: (page: Page) => Promise<string[]>;
  refreshBoardForUser: (user: SessionUser | null) => Promise<string[]>;

  // terminal state + setters
  authFlow: AuthFlow;
  setAuthFlow: Dispatch<SetStateAction<AuthFlow>>;
  setAuthError: Dispatch<SetStateAction<string>>;
  // cancel token, an async handler bails out if it moved while awaiting
  flowEpoch: { current: number };
  writeFlow: WriteFlow;
  setWriteFlow: Dispatch<SetStateAction<WriteFlow>>;
  setWriteError: Dispatch<SetStateAction<string>>;
  // closes the ? popover and, with it, any second layer it was showing
  closeCommandHelp: () => void;
  logVisible: boolean;
  setLogVisible: Dispatch<SetStateAction<boolean>>;

  // helpers
  addLine: (line: string) => void;
  clearWriteModes: () => void;
  goTo: (path: string) => void;
  goBack: () => void;

  // i18n
  t: TranslateFn;
  setLang: (lang: Lang) => void;

  // navigation
  navigate: NavigateFunction;
}
