// One helper, used by every catch block that has to show the user something.
// `catch` hands you `unknown`, so without this each one repeats the same
// instanceof check before it can reach .message.

// message to show for a thrown value, falls back when it isn't an Error
export function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}
