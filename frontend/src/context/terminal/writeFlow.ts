import {
  createDiscussion,
  createPost,
  getUserByName,
  sendMail,
} from "../../api";
import { censor } from "../../components/moderation";
import { PAGE_PATHS } from "../../router";
import type { TerminalDeps } from "./deps";
import { errMsg } from "./helpers";

export function createWriteFlowHandlers(deps: TerminalDeps) {
  const {
    page,
    sessionUser,
    selectedDiscussion,
    writeFlow,
    setWriteFlow,
    setWriteError,
    clearWriteModes,
    setSelectedDiscussion,
    refreshBoard,
    navigate,
    addLine,
    t,
    setAuthFlow,
    setAuthError,
    goTo,
  } = deps;

  async function handleWriteFlowInput(rawInput: string) {
    if (!writeFlow || !sessionUser) return;

    if (writeFlow.mode === "mail") {
      if (writeFlow.step === "recipient") {
        const recipient = await getUserByName(rawInput).catch(() => null);
        if (!recipient) {
          setWriteError(t("Recipient name does not exist."));
          addLine(
            t("recipient not found. enter another name, or press Ctrl+C/Esc."),
          );
          return;
        }
        setWriteError("");
        setWriteFlow({
          mode: "mail",
          step: "title",
          recipient: recipient.name,
          title: "",
        });
        addLine(
          t("recipient accepted: {name}. enter title.", {
            name: recipient.name,
          }),
        );
        return;
      }
      if (writeFlow.step === "title") {
        setWriteError("");
        setWriteFlow({ ...writeFlow, step: "body", title: rawInput });
        addLine(t("title accepted. enter message."));
        return;
      }
      try {
        await sendMail(
          sessionUser.id,
          writeFlow.recipient,
          await censor(writeFlow.title),
          await censor(rawInput),
        );
        const recipientName = writeFlow.recipient;
        clearWriteModes();
        (await refreshBoard()).forEach(addLine);
        addLine(t("mail sent to {name}.", { name: recipientName }));
      } catch (error) {
        setWriteError(errMsg(error, t("Could not send mail.")));
        addLine(
          t("mail failed. press Ctrl+C/Esc to quit, or enter message again."),
        );
      }
      return;
    }

    if (writeFlow.mode === "new-discussion") {
      if (writeFlow.step === "title") {
        setWriteFlow({ mode: "new-discussion", step: "body", title: rawInput });
        addLine(t("title accepted. enter first post."));
        return;
      }
      try {
        const discussion = await createDiscussion(
          await censor(writeFlow.title),
          await censor(rawInput),
          sessionUser.id,
        );
        setSelectedDiscussion(discussion);
        clearWriteModes();
        (await refreshBoard()).forEach(addLine);
        navigate(`/discussions/show/${discussion.id}`);
        addLine(t("discussion posted."));
      } catch (error) {
        setWriteError(errMsg(error, t("Could not write discussion.")));
        addLine(
          t("discussion failed. press Ctrl+C/Esc to quit, or enter post again."),
        );
      }
      return;
    }

    // reply
    try {
      const discussion = await createPost(
        writeFlow.discussionId,
        await censor(rawInput),
        sessionUser.id,
      );
      setSelectedDiscussion(discussion);
      clearWriteModes();
      (await refreshBoard()).forEach(addLine);
      addLine(t("reply posted."));
    } catch (error) {
      setWriteError(errMsg(error, t("Could not post reply.")));
      addLine(
        t("reply failed. press Ctrl+C/Esc to quit, or enter reply again."),
      );
    }
  }

  function handleWriteCommand() {
    if (!sessionUser) {
      addLine(t("login first to write."));
      setAuthFlow({ mode: "login", step: "name", name: "" });
      setAuthError("");
      goTo(PAGE_PATHS.login);
      return;
    }

    if (page === "discussions") {
      setWriteFlow({ mode: "new-discussion", step: "title", title: "" });
      setWriteError("");
      addLine(t("new discussion. enter title."));
      return;
    }

    if (page === "discussion-detail") {
      if (!selectedDiscussion) {
        addLine(t("no discussion selected."));
        return;
      }
      setWriteFlow({ mode: "reply", discussionId: selectedDiscussion.id });
      setWriteError("");
      addLine(t("enter reply."));
      return;
    }

    if (page === "mail") {
      setWriteFlow({
        mode: "mail",
        step: "recipient",
        recipient: "",
        title: "",
      });
      setWriteError("");
      addLine(t("enter recipient name."));
      return;
    }

    addLine(t("write is not available on this page."));
  }

  return { handleWriteFlowInput, handleWriteCommand };
}
