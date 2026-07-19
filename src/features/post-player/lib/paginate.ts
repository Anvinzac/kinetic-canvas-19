import { getTextPageWordLimit, getWords } from "@/features/kinetic-text";

type RawTextPage = { text: string; mergeable: boolean };

type TextPageUnit = {
  words: string[];
  weight: number;
};

const MIN_STANDALONE_PAGE_WORDS = 3;

/**
 * @responsibility Split status / canvas text into kinetic page strings.
 * @inputs Free-form post text (newlines, sentences, bonded phrases)
 * @outputs Ordered page strings; empty input → `[""]`
 * @pure true
 */
export function paginateText(text: string) {
  const blocks = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((block) => block.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
  if (blocks.length === 0) return [""];

  return mergeShortTextPages(blocks.flatMap((block) => paginateTextBlock(block)));
}

function paginateTextBlock(text: string): RawTextPage[] {
  const wordLimit = getTextPageWordLimit(text);
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [text];
  return sentences
    .flatMap((sentence) => chunkSentenceByWords(sentence.trim(), wordLimit))
    .filter((page) => page.text);
}

function chunkSentenceByWords(sentence: string, wordLimit: number): RawTextPage[] {
  const words = sentence.match(/\S+/g) ?? [];
  if (words.length <= wordLimit) return [{ text: sentence, mergeable: false }];

  const units = getTextPageUnits(words);
  const pageCount = Math.ceil(words.length / wordLimit);
  const targetWordsPerPage = Math.ceil(words.length / pageCount);
  const chunks: string[] = [];
  let currentWords: string[] = [];
  let currentWeight = 0;

  const flush = () => {
    if (currentWords.length === 0) return;
    chunks.push(currentWords.join(" "));
    currentWords = [];
    currentWeight = 0;
  };

  const retreatToLastNaturalBreak = () => {
    const breakIndex = findLastNaturalBreakIndex(currentWords);
    if (breakIndex < 0 || breakIndex >= currentWords.length - 1) return false;
    const head = currentWords.slice(0, breakIndex + 1);
    const tail = currentWords.slice(breakIndex + 1);
    chunks.push(head.join(" "));
    currentWords = tail;
    currentWeight = tail.length;
    return true;
  };

  for (const unit of units) {
    const wouldOverflow =
      currentWords.length > 0 && currentWeight + unit.weight > targetWordsPerPage;

    if (wouldOverflow) {
      // Back up to the last comma / full stop instead of splitting mid-phrase
      // (e.g. keep "tốc độ" together on the next page).
      if (!retreatToLastNaturalBreak()) {
        flush();
      }
    }

    currentWords.push(...unit.words);
    currentWeight += unit.weight;

    // After a full stop or completed hyphen phrase, close the page.
    if (shouldEndTextPageAfterUnit(unit)) {
      flush();
    }
  }

  flush();

  if (chunks.length <= 1) {
    return [{ text: sentence, mergeable: false }];
  }

  // The first chunk heads the sentence (deliberate); later chunks are overflow
  // continuations that may merge back if they end up too short.
  return chunks.map((text, index) => ({ text, mergeable: index > 0 }));
}

function findLastNaturalBreakIndex(words: string[]) {
  for (let index = words.length - 1; index >= 0; index--) {
    const word = words[index] ?? "";
    if (/[.!?]["')\]]*$/.test(word)) return index;
    if (/[,;:]["')\]]*$/.test(word)) return index;
  }
  return -1;
}

function shouldEndTextPageAfterUnit(unit: TextPageUnit) {
  const lastWord = unit.words[unit.words.length - 1] ?? "";
  if (/[.!?]["')\]]*$/.test(lastWord)) return true;
  return unit.words.some((word) => isStandaloneHyphen(word));
}

function getTextPageUnits(words: string[]): TextPageUnit[] {
  const units: TextPageUnit[] = [];

  for (let index = 0; index < words.length; ) {
    if (index + 2 < words.length && isStandaloneHyphen(words[index + 1])) {
      units.push({ words: words.slice(index, index + 3), weight: 3 });
      index += 3;
      continue;
    }

    if (index + 1 < words.length && isStandaloneHyphen(words[index])) {
      units.push({ words: words.slice(index, index + 2), weight: 2 });
      index += 2;
      continue;
    }

    units.push({ words: [words[index]], weight: 1 });
    index += 1;
  }

  return units;
}

function isStandaloneHyphen(word: string) {
  return /^[-–—]+$/.test(word.trim());
}

// Anti-orphan: only overflow continuations may merge; deliberate pages stay.
function mergeShortTextPages(pages: RawTextPage[]) {
  const merged: RawTextPage[] = [];

  for (const page of pages) {
    const normalized = page.text.trim();
    if (!normalized) continue;

    // Pull a short page back ONLY when it is an overflow continuation of the
    // previous page — a deliberate short page (whole line / one-word reveal)
    // always keeps its own page.
    if (
      page.mergeable &&
      getWords(normalized).length < MIN_STANDALONE_PAGE_WORDS &&
      merged.length > 0
    ) {
      merged[merged.length - 1].text = joinTextPages(merged[merged.length - 1].text, normalized);
      continue;
    }

    merged.push({ text: normalized, mergeable: page.mergeable });
  }

  return merged.map((page) => page.text);
}

function joinTextPages(left: string, right: string) {
  return `${left.trim()} ${right.trim()}`.trim();
}
