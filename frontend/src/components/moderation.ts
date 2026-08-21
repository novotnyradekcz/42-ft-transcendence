// Swear filter for anything the user writes — mail, discussions, replies.
//
// The word list is a plain text file served from /public rather than a bundled
// constant, so it can be edited without a rebuild. That's also why censor() is
// async: the first call may still be waiting on that fetch.
//
// Client-side only, so it's a courtesy and not a control — anything that
// matters has to be filtered again on the server.

// cached word list
let wordList: string[] | null = null;
// in-flight fetch, so we don't fetch twice
let loadPromise: Promise<string[]> | null = null;

// fetches and parses the swear list file
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

// preloads the word list early
export function initModeration(): void {
  void loadWordList();
}

// builds a regex matching any of the words. escaped because the file is
// hand-edited and a stray `(` would otherwise throw at match time
function buildPattern(words: string[]): RegExp | null {
  if (words.length === 0) {
    return null;
  }

  const escaped = words
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  return new RegExp(`\\b(?:${escaped})\\b`, "gi");
}

// replaces swear words with asterisks, keeping the length so the shape of the
// sentence survives. \b anchors mean only whole words match — "class" is safe,
// and by the same token "cl@ss" gets through.
export async function censor(text: string): Promise<string> {
  const words = await loadWordList();
  const pattern = buildPattern(words);
  if (!pattern) {
    return text;
  }

  return text.replace(pattern, (match) => "*".repeat(match.length));
}
