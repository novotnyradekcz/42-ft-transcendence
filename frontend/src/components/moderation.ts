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

// builds a regex matching any of the words
function buildPattern(words: string[]): RegExp | null {
  if (words.length === 0) {
    return null;
  }

  const escaped = words
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  return new RegExp(`\\b(?:${escaped})\\b`, "gi");
}

// replaces swear words with asterisks
export async function censor(text: string): Promise<string> {
  const words = await loadWordList();
  const pattern = buildPattern(words);
  if (!pattern) {
    return text;
  }

  return text.replace(pattern, (match) => "*".repeat(match.length));
}
