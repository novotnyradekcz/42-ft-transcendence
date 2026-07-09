/**
 * Flow-state types for the terminal's multi-step input modes.
 * Kept in a standalone file so page components can import them without
 * pulling in the full TerminalContext module.
 */

export type AuthFlow =
  | null
  | { mode: "login"; step: "name" | "password"; name: string }
  | {
      mode: "register";
      step: "name" | "email" | "password";
      name: string;
      email: string;
    };

export type WriteFlow =
  | null
  | { mode: "new-discussion"; step: "title" | "body"; title: string }
  | { mode: "reply"; discussionId: number }
  | {
      mode: "mail";
      step: "recipient" | "title" | "body";
      recipient: string;
      title: string;
    };
