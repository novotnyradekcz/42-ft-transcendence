// What TerminalProvider exposes. Roughly three groups: the command line itself,
// the flow state for whatever multi-step prompt is running, and the handlers
// the input and the ? popover call into.

import type {
  Dispatch,
  FormEvent,
  KeyboardEvent,
  SetStateAction,
} from "react";
import type { AuthFlow, WriteFlow } from "../../terminalTypes";
import type { HelpSubmenu } from "./helpMenu";
import type { Page } from "../../types";

export type { AuthFlow, WriteFlow };

export interface TerminalContextValue {
  // current text in the command input
  commandInput: string;
  setCommandInput: Dispatch<SetStateAction<string>>;
  // lines rendered in the output panel
  terminalLines: string[];
  addLine: (line: string) => void;
  // bumped whenever the input should take focus
  focusInputSignal: number;
  // whether the activity log is shown, off by default
  logVisible: boolean;

  authFlow: AuthFlow;
  authError: string;
  writeFlow: WriteFlow;
  writeError: string;

  commandHelpOpen: boolean;
  toggleCommandHelp: () => void;
  // second layer of the ? menu, null while the command list is showing
  helpSubmenu: HelpSubmenu | null;
  availableCommands: string[];
  // true while a command is waiting on the network
  isBusy: boolean;
  page: Page;

  handleCommandSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleCommandKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  handleCommandHelpClick: (label: string) => Promise<void>;
  // picks a value out of the second layer and runs the command with it
  handleCommandHelpSelect: (value: string) => Promise<void>;
  // back to the first layer
  closeCommandHelpSubmenu: () => void;
  cancelInputMode: () => void;
  getPromptLabel: () => string;
}
