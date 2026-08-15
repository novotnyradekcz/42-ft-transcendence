import type {
  Dispatch,
  FormEvent,
  KeyboardEvent,
  SetStateAction,
} from "react";
import type { AuthFlow, WriteFlow } from "../../terminalTypes";
import type { Page } from "../../types";

export type { AuthFlow, WriteFlow };

// shape of the terminal context
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
  setCommandHelpOpen: Dispatch<SetStateAction<boolean>>;
  availableCommands: string[];
  // true while a command is waiting on the network
  isBusy: boolean;
  page: Page;

  handleCommandSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleCommandKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  handleCommandHelpClick: (label: string) => Promise<void>;
  cancelInputMode: () => void;
  getPromptLabel: () => string;
}
