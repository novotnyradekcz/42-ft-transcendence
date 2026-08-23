// Walks the login and register prompts, one field per submitted line.
//
// The last step is the only one that talks to the server. The user can cancel
// while that request is in flight, and it may still succeed — so the epoch
// check below logs the resulting session straight back out rather than leaving
// them signed in after they pressed Ctrl+C.

import { PAGE_PATHS } from "../../router";
import type { TerminalDeps } from "./deps";
import { nameProblem, RegisteredNotSignedInError } from "../../api";
import { errMsg } from "../../errors";

export function createAuthFlowHandlers(deps: TerminalDeps) {
  const {
    authFlow,
    setAuthFlow,
    setAuthError,
    flowEpoch,
    login,
    register,
    contextLogout,
    refreshBoardForUser,
    navigate,
    addLine,
    t,
  } = deps;

  // true if the user cancelled while epoch was in flight
  // the request may have succeeded, so drop the session it opened
  function cancelledDuring(epoch: number): boolean {
    if (flowEpoch.current === epoch) return false;
    contextLogout();
    addLine(t("login/register cancelled."));
    return true;
  }

  // one line of input = one step. the early steps just record the answer and
  // move on; the password step is what actually submits
  async function handleAuthFlowInput(rawInput: string) {
    if (!authFlow) return;

    if (authFlow.mode === "login") {
      if (authFlow.step === "name") {
        setAuthFlow({ ...authFlow, step: "password", name: rawInput });
        addLine(t("name accepted. enter password."));
        return;
      }
      const loginEpoch = flowEpoch.current;
      try {
        const nextUser = await login(authFlow.name, rawInput);
        if (cancelledDuring(loginEpoch)) return;
        setAuthFlow(null);
        setAuthError("");
        (await refreshBoardForUser(nextUser)).forEach(addLine);
        navigate(PAGE_PATHS.home);
        addLine(t("logged in as {name}.", { name: nextUser.name }));
      } catch (error) {
        // a cancelled flow shouldn't report a failure the user isn't waiting on
        if (flowEpoch.current !== loginEpoch) return;
        setAuthError(errMsg(error, "Login failed.", t));
        addLine(
          t("login failed. press Ctrl+C or Esc to quit, or enter name again."),
        );
        // back to the first step rather than dropped, so a typo can be retried
        setAuthFlow({ mode: "login", step: "name", name: "" });
      }
      return;
    }

    // register
    if (authFlow.step === "name") {
      // caught here, not after the password step: one line instead of three
      const problem = nameProblem(rawInput);
      if (problem) {
        setAuthError(t(problem));
        addLine(t(problem));
        return;
      }
      setAuthError("");
      setAuthFlow({ ...authFlow, step: "email", name: rawInput });
      addLine(t("name accepted. enter email."));
      return;
    }
    if (authFlow.step === "email") {
      setAuthFlow({ ...authFlow, step: "password", email: rawInput });
      addLine(t("email accepted. enter password."));
      return;
    }
    const registerEpoch = flowEpoch.current;
    try {
      const nextUser = await register(authFlow.name, authFlow.email, rawInput);
      // The account itself stays — only the session it opened is dropped.
      if (cancelledDuring(registerEpoch)) return;
      setAuthFlow(null);
      setAuthError("");
      (await refreshBoardForUser(nextUser)).forEach(addLine);
      navigate(PAGE_PATHS.home);
      addLine(t("registered and logged in as {name}.", { name: nextUser.name }));
    } catch (error) {
      if (flowEpoch.current !== registerEpoch) return;
      setAuthError(errMsg(error, "Registration failed.", t));
      // the account is there, only the sign-in failed. carry on as a login
      // rather than ask for a name that is now taken
      if (error instanceof RegisteredNotSignedInError) {
        addLine(t("account created. enter password to log in."));
        setAuthFlow({ mode: "login", step: "password", name: authFlow.name });
        return;
      }
      addLine(
        t("registration failed. press Ctrl+C or Esc to quit, or enter name again."),
      );
      setAuthFlow({ mode: "register", step: "name", name: "", email: "" });
    }
  }

  return { handleAuthFlowInput };
}
