import type {
  Dispatch,
  FormEvent,
  KeyboardEvent,
  SetStateAction,
} from "react";
import type { AuthFlow, WriteFlow } from "../../terminalTypes";
import type { Page } from "../../types";

export type { AuthFlow, WriteFlow };

export interface TerminalContextValue {
  /** Current text in the command input. */
  commandInput: string;
  setCommandInput: Dispatch<SetStateAction<string>>;
  /** Rendered lines in the terminal output panel. */
  terminalLines: string[];
  /** Append a line to the terminal output. */
  addLine: (line: string) => void;
  /** Incremented whenever the terminal context wants the input to be focused. */
  focusInputSignal: number;

  authFlow: AuthFlow;
  authError: string;
  writeFlow: WriteFlow;
  writeError: string;

  commandHelpOpen: boolean;
  setCommandHelpOpen: Dispatch<SetStateAction<boolean>>;
  availableCommands: string[];
  page: Page;

  handleCommandSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleCommandKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  handleCommandHelpClick: (label: string) => Promise<void>;
  cancelInputMode: () => void;
  getPromptLabel: () => string;
}
