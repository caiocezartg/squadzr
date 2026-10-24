/** IGDB game-mode ids that make a game formable in a Squad. */
export const CANDIDATE_GAME_MODES = [2, 3, 5, 6] as const
// 2 Multiplayer, 3 Co-operative, 5 MMO, 6 Battle Royale.

/** IGDB game-type ids that are real games, not DLCs, bundles or editions. */
export const CANDIDATE_GAME_TYPES = [0, 4, 8, 9, 10] as const
// 0 Main game, 4 Standalone expansion, 8 Remake, 9 Remaster, 10 Expanded game.

export const IGDB_PAGE_SIZE = 500

const GAME_FIELDS = [
  'id',
  'name',
  'slug',
  'cover.image_id',
  'genres.name',
  'genres.slug',
  'multiplayer_modes.onlinecoopmax',
  'multiplayer_modes.onlinemax',
  'first_release_date',
  'total_rating_count',
].join(',')

export interface GamesPageQueryInput {
  /** Minimum `total_rating_count` a game needs to become a candidate. */
  readonly threshold: number
  /** Exclusive upper bound of the first release date. */
  readonly releasedBefore: Date
  readonly offset: number
}

function fieldsClause(): string {
  return `fields ${GAME_FIELDS};`
}

/**
 * One page of the candidate query: every filter of the Catalog Import lives
 * here so the IGDB endpoint, not the adapter, narrows the catalog.
 */
export function buildGamesPageQuery(input: GamesPageQueryInput): string {
  const releasedBeforeSeconds = Math.floor(input.releasedBefore.getTime() / 1000)

  return [
    fieldsClause(),
    `where game_modes = (${CANDIDATE_GAME_MODES.join(',')}) & game_type = (${CANDIDATE_GAME_TYPES.join(',')}) & version_parent = null & cover != null & slug != null & first_release_date < ${releasedBeforeSeconds} & total_rating_count >= ${input.threshold};`,
    `limit ${IGDB_PAGE_SIZE};`,
    `offset ${input.offset};`,
    'sort id asc;',
  ].join(' ')
}

/**
 * Curated games are candidates whatever the threshold and the other filters:
 * they are fetched explicitly by id and merged into the result afterwards.
 */
export function buildCuratedGamesQuery(igdbIds: readonly number[]): string {
  return [
    fieldsClause(),
    `where id = (${igdbIds.join(',')});`,
    `limit ${IGDB_PAGE_SIZE};`,
    'sort id asc;',
  ].join(' ')
}
