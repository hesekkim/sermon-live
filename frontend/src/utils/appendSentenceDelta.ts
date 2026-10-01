const abbreviations = new Set([
  'bzw',
  'ca',
  'd',
  'dr',
  'ehem',
  'etc',
  'evtl',
  'fr',
  'geb',
  'gest',
  'ggf',
  'hr',
  'inkl',
  'jh',
  'mio',
  'nr',
  'prof',
  'sog',
  'st',
  'str',
  'tel',
  'usw',
  'u',
  'vgl',
  'z',
]);

function isAbbreviationBoundary(text: string, boundaryStart: number): boolean {
  const prefix = text.slice(0, boundaryStart);
  const previousWord = prefix
    .match(/[\p{L}\d]+$/u)?.[0]
    .toLocaleLowerCase('de');
  if (previousWord && abbreviations.has(previousWord)) return true;
  if (previousWord && /^\d+$/.test(previousWord)) return true;

  return /(?:^|\s)(?:z|d|u)\.\s*(?:b|h|a)$/i.test(prefix);
}

export function appendSentenceDelta(lines: string[], delta: string): string[] {
  if (!delta) return lines;

  const completed = lines.slice(0, -1);
  let current = lines.at(-1) ?? '';
  const isClosingOnly = /^[\s"'”’»›)\]}]+$/.test(delta);
  const ending = current.match(/[.!?…。！？]+["'”’»›)\]}]*\s*$/);
  if (
    ending &&
    !isClosingOnly &&
    delta.trim() &&
    !isAbbreviationBoundary(current, ending.index ?? 0)
  ) {
    completed.push(current.trimEnd());
    current = '';
  }

  const combined = current + delta;
  const sentenceEnd = /[.!?…。！？]+["'”’»›)\]}]*\s+(?=\S)/g;
  let segmentStart = 0;
  for (const match of combined.matchAll(sentenceEnd)) {
    const boundaryStart = match.index ?? 0;
    if (isAbbreviationBoundary(combined, boundaryStart)) continue;

    const boundaryEnd = boundaryStart + match[0].trimEnd().length;
    const sentence = combined.slice(segmentStart, boundaryEnd).trim();
    if (sentence) completed.push(sentence);
    segmentStart = boundaryStart + match[0].length;
  }

  const remainder = combined.slice(segmentStart).trimStart();
  return remainder ? [...completed, remainder] : completed;
}
