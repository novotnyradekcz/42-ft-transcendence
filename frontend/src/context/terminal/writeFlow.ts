// Walks the three write prompts — a new discussion, a reply, and mail — and
// posts the result.
//
// Which one `write` starts depends on the page it was typed on; there is no
// separate command per kind. Everything the user types goes through censor()
// before it's sent.

import {
  createDiscussion,
  createPost,
  getUserByName,
  sendMail,
} from "../../api";
import { censor } from "../../components/moderation";
import type { TerminalDeps } from "./deps";
import { errMsg } from "../../errors";
import { startLoginFlow } from "./helpers";

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
    refreshForPage,
    navigate,
    addLine,
    t,
  } = deps;

  // one line of input per step, same shape as the auth flow. the last step of
  // each mode is the one that posts
  async function handleWriteFlowInput(rawInput: string) {
    if (!writeFlow || !sessionUser) return;

    if (writeFlow.mode === "mail") {
      // the recipient is checked before the message is written, so a bad name
      // isn't discovered after typing the whole thing
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
        (await refreshForPage("mail")).forEach(addLine);
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
        (await refreshForPage("discussions")).forEach(addLine);
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
      (await refreshForPage("discussions")).forEach(addLine);
      addLine(t("reply posted."));
    } catch (error) {
      setWriteError(errMsg(error, t("Could not post reply.")));
      addLine(
        t("reply failed. press Ctrl+C/Esc to quit, or enter reply again."),
      );
    }
  }

  // `write` means something different on each page, and nothing on most of them
  function handleWriteCommand() {
    if (!sessionUser) {
      addLine(t("login first to write."));
      startLoginFlow(deps);
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
