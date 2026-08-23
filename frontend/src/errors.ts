// One helper, used by the catch blocks that have to show the user something.
// `catch` hands you `unknown`, so without this each one repeats the same
// instanceof check before it can reach .message.
//
// It also translates. Server error messages arrive as English strings on the
// Error, and the UI would otherwise show them untranslated next to translated
// text — so both the message and the fallback go through t(). Keys are the
// English strings themselves, so a server message that has been added to the
// dictionaries is translated and one that hasn't still renders as English.

import type { TranslateFn } from "./context/language/i18n";

// message to show for a thrown value, falls back when it isn't an Error
export function errMsg(e: unknown, fallback: string, t: TranslateFn): string {
  return t(e instanceof Error ? e.message : fallback);
}
