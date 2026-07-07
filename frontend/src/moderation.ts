// Content moderation: a simple word-list censor (the "swear filter").
//
// The list lives in /public/swear-filter.txt (one word per line; lines starting
// with '#' are comments) and is fetched at runtime, so moderators can edit the
// list without rebuilding the app. The file is intentionally empty for now,
// which makes `censor` a no-op until words are added.

let wordList: string[] | null = null;
let loadPromise: Promise<string[]> | null = null;

async function loadWordList(): Promise<string[]> {
  if (wordList) {
    return wordList;
  }

  if (!loadPromise) {
    loadPromise = fetch("/swear-filter.txt")
      .then((response) => (response.ok ? response.text() : ""))
      .catch(() => "")
      .then((text) => {
        wordList = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && !line.startsWith("#"));
        return wordList;
      });
  }

  return loadPromise;
}

/** Preload the word list so the first submission doesn't pay the fetch cost. */
export function initModeration(): void {
  void loadWordList();
}

function buildPattern(words: string[]): RegExp | null {
  if (words.length === 0) {
    return null;
  }

  const escaped = words
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  return new RegExp(`\\b(?:${escaped})\\b`, "gi");
}

/** Replace any banned word with asterisks. Returns the text unchanged when the list is empty. */
export async function censor(text: string): Promise<string> {
  const words = await loadWordList();
  const pattern = buildPattern(words);
  if (!pattern) {
    return text;
  }

  return text.replace(pattern, (match) => "*".repeat(match.length));
}
