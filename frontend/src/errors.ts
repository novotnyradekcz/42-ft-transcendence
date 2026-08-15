// message to show for a thrown value, falls back when it isn't an Error
export function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}
