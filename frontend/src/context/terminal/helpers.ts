import type { AuthFlow, WriteFlow } from "../../terminalTypes";
import type { SessionUser } from "../../types";

export function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
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
