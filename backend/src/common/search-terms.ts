const PORTUGUESE_ACCENTS: Record<string, string[]> = {
  a: ['á', 'à', 'â', 'ã'],
  e: ['é', 'ê'],
  i: ['í'],
  o: ['ó', 'ô', 'õ'],
  u: ['ú'],
  c: ['ç'],
};

/** Build a bounded set of spellings so unaccented input also finds accented names. */
export function searchTerms(value: string): string[] {
  const trimmed = value.trim();
  const plain = trimmed.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const terms = new Set([trimmed, plain]);

  for (let index = 0; index < plain.length && terms.size < 128; index += 1) {
    const alternatives = PORTUGUESE_ACCENTS[plain[index].toLowerCase()];
    if (!alternatives) continue;

    for (const accent of alternatives) {
      if (terms.size >= 128) break;
      const candidate =
        plain.slice(0, index) +
        (plain[index] === plain[index].toUpperCase()
          ? accent.toUpperCase()
          : accent) +
        plain.slice(index + 1);
      terms.add(candidate);
    }
  }

  return [...terms];
}
