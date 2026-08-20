// The terminal's two multi-step input modes, as state. Instead of a form, the
// prompt asks for one field at a time and keeps the answers here until the
// last step submits them.
//
// Their own file so the page components can import the types without pulling in
// the whole TerminalContext module.

// signing in or signing up. `step` is the field the prompt is asking for now,
// and the fields before it hold what was already answered. null = not running
export type AuthFlow =
  | null
  | { mode: "login"; step: "name" | "password"; name: string }
  | {
      mode: "register";
      step: "name" | "email" | "password";
      name: string;
      email: string;
    };

// posting something. `reply` has no steps — the body is a single line — which
// is why it carries an id instead of a step
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
