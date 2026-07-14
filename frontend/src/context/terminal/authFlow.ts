import { PAGE_PATHS } from "../../router";
import type { TerminalDeps } from "./deps";
import { errMsg } from "./helpers";

export function createAuthFlowHandlers(deps: TerminalDeps) {
  const {
    authFlow,
    setAuthFlow,
    setAuthError,
    login,
    register,
    refreshBoardForUser,
    navigate,
    addLine,
    t,
  } = deps;

  async function handleAuthFlowInput(rawInput: string) {
    if (!authFlow) return;

    if (authFlow.mode === "login") {
      if (authFlow.step === "name") {
        setAuthFlow({ ...authFlow, step: "password", name: rawInput });
        addLine(t("name accepted. enter password."));
        return;
      }
      try {
        const nextUser = await login(authFlow.name, rawInput);
        setAuthFlow(null);
        setAuthError("");
        (await refreshBoardForUser(nextUser)).forEach(addLine);
        navigate(PAGE_PATHS.home);
        addLine(t("logged in as {name}.", { name: nextUser.name }));
      } catch (error) {
        setAuthError(errMsg(error, t("Login failed.")));
        addLine(
          t("login failed. press Ctrl+C or Esc to quit, or enter name again."),
        );
        setAuthFlow({ mode: "login", step: "name", name: "" });
      }
      return;
    }

    // register
    if (authFlow.step === "name") {
      setAuthFlow({ ...authFlow, step: "email", name: rawInput });
      addLine(t("name accepted. enter email."));
      return;
    }
    if (authFlow.step === "email") {
      setAuthFlow({ ...authFlow, step: "password", email: rawInput });
      addLine(t("email accepted. enter password."));
      return;
    }
    try {
      const nextUser = await register(authFlow.name, authFlow.email, rawInput);
      setAuthFlow(null);
      setAuthError("");
      (await refreshBoardForUser(nextUser)).forEach(addLine);
      navigate(PAGE_PATHS.home);
      addLine(t("registered and logged in as {name}.", { name: nextUser.name }));
    } catch (error) {
      setAuthError(errMsg(error, t("Registration failed.")));
      addLine(
        t("registration failed. press Ctrl+C or Esc to quit, or enter name again."),
      );
      setAuthFlow({ mode: "register", step: "name", name: "", email: "" });
    }
  }

  return { handleAuthFlowInput };
}
