import type { AuthFlow, WriteFlow } from "../../terminalTypes";
import type { SessionUser } from "../../types";
import { PAGE_PATHS } from "../../router";
import type { TerminalDeps } from "./deps";

// sends the user to the login screen with a fresh prompt
export function startLoginFlow(
  deps: Pick<TerminalDeps, "setAuthFlow" | "setAuthError" | "goTo">,
): void {
  deps.setAuthFlow({ mode: "login", step: "name", name: "" });
  deps.setAuthError("");
  deps.goTo(PAGE_PATHS.login);
}

export function getPromptLabel(
  authFlow: AuthFlow,
  writeFlow: WriteFlow,
  sessionUser: SessionUser | null,
): string {
  if (authFlow?.mode === "login") return `login/${authFlow.step}:`;
  if (authFlow?.mode === "register") return `register/${authFlow.step}:`;
  if (writeFlow?.mode === "mail") return `mail/${writeFlow.step}:`;
  if (writeFlow?.mode === "new-discussion")
    return `discussion/${writeFlow.step}:`;
  if (writeFlow?.mode === "reply") return "reply/body:";
  if (!sessionUser) return "guest@ft_transcendence:$";
  return `${sessionUser.name}@ft_transcendence:$`;
}
