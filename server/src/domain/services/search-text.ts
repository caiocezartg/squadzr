/**
 * Folds a name or a search term to the form Game Search compares: accents,
 * case and punctuation do not matter. "Counter-Strike 2" and "counter strike 2"
 * fold to the same text, and a term made only of punctuation folds to "".
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Separates the normalized name from the normalized aliases in a Game's search text. */
export const SEARCH_TEXT_SEPARATOR = ' | '

/**
 * The aliases a Game stores: folded, without blanks, without repeats and
 * without the Game's own folded name, in first-seen order.
 */
export function normalizeAliases(name: string, aliases: readonly string[]): string[] {
  const normalizedName = normalizeSearchText(name)
  const unique = new Set<string>()

  for (const alias of aliases) {
    const normalized = normalizeSearchText(alias)
    if (normalized !== '' && normalized !== normalizedName) unique.add(normalized)
  }

  return [...unique]
}

/** The normalized name followed by the aliases, joined by {@link SEARCH_TEXT_SEPARATOR}. */
export function buildSearchText(name: string, normalizedAliases: readonly string[]): string {
  return [normalizeSearchText(name), ...normalizedAliases].join(SEARCH_TEXT_SEPARATOR)
}
