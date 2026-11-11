import type { PublicSquad } from '@/types'

/** How many tag toggles the filters panel lists before the selected tags that rank lower. */
const MAX_TAG_OPTIONS = 8

/** A tag as the board compares it: without a leading `#`, trimmed and lowercase. */
export function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#+/, '').trim().toLowerCase()
}

/** The tags a selection holds, normalized, without blanks or repeats, in the order they were given. */
export function normalizeTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map(normalizeTag).filter((tag) => tag !== ''))]
}

/** Whether the Squad has every selected tag, compared exactly. An empty selection matches every Squad. */
export function hasEveryTag(squad: PublicSquad, selected: readonly string[]): boolean {
  if (selected.length === 0) return true
  const squadTags = new Set(squad.tags.map(normalizeTag))
  return selected.every((tag) => squadTags.has(tag))
}

/**
 * The tag toggles of the filters panel: the eight tags the most Squads use (ties by name), then each
 * selected tag that is not among them, in the order it was selected. The Squads are the board's whole
 * list, so the options do not move as the filters narrow it.
 */
export function rankTagOptions(
  squads: readonly PublicSquad[],
  selected: readonly string[]
): string[] {
  const uses = new Map<string, number>()
  for (const squad of squads) {
    for (const tag of normalizeTags(squad.tags)) uses.set(tag, (uses.get(tag) ?? 0) + 1)
  }

  const ranked = [...uses]
    .sort(([tagA, usesA], [tagB, usesB]) => usesB - usesA || tagA.localeCompare(tagB, 'en'))
    .slice(0, MAX_TAG_OPTIONS)
    .map(([tag]) => tag)

  return [...ranked, ...selected.filter((tag) => !ranked.includes(tag))]
}
