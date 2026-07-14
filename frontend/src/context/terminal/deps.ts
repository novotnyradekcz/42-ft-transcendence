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

/**
 * Everything the extracted terminal handler factories need from the provider.
 * The provider rebuilds this object every render with the current state and
 * setters, so the closures the factories return always see fresh values.
 */
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
  refreshBoard: () => Promise<string[]>;
  refreshBoardForUser: (user: SessionUser | null) => Promise<string[]>;

  // terminal state + setters
  authFlow: AuthFlow;
  setAuthFlow: Dispatch<SetStateAction<AuthFlow>>;
  setAuthError: Dispatch<SetStateAction<string>>;
  writeFlow: WriteFlow;
  setWriteFlow: Dispatch<SetStateAction<WriteFlow>>;
  setWriteError: Dispatch<SetStateAction<string>>;
  setCommandHelpOpen: Dispatch<SetStateAction<boolean>>;

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
