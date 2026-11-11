import { normalizeSearchText } from '@squadzr/schemas'

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
