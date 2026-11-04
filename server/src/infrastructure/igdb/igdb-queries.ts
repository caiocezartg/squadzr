/** IGDB game-mode ids that make a game formable in a Squad. */
const CANDIDATE_GAME_MODES = [2, 3, 5, 6] as const
// 2 Multiplayer, 3 Co-operative, 5 MMO, 6 Battle Royale.

/** IGDB game-type ids that are real games, not DLCs, bundles or editions. */
const CANDIDATE_GAME_TYPES = [0, 4, 8, 9, 10] as const
// 0 Main game, 4 Standalone expansion, 8 Remake, 9 Remaster, 10 Expanded game.

export const IGDB_PAGE_SIZE = 500

/** IGDB `popularity_primitives` types: 3 is IGDB "Playing", 5 is Steam "24hr Peak Players". */
export const IGDB_POPULARITY_TYPE_PLAYING = 3
export const IGDB_POPULARITY_TYPE_STEAM_PEAK = 5

/** Ids per popularity query; each batch is still paged, so extra rows are never cut off. */
export const IGDB_POPULARITY_BATCH_SIZE = 250

const GAME_FIELDS = [
  'id',
  'name',
  'slug',
  'cover.image_id',
  'genres.name',
  'genres.slug',
  'platforms',
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

/**
 * One page of the Playing and Steam Peak rows of up to
 * {@link IGDB_POPULARITY_BATCH_SIZE} games, sorted by id so offsets are stable.
 */
export function buildPopularityPrimitivesQuery(igdbIds: readonly number[], offset = 0): string {
  return [
    'fields game_id,popularity_type,value;',
    `where popularity_type = (${IGDB_POPULARITY_TYPE_PLAYING},${IGDB_POPULARITY_TYPE_STEAM_PEAK}) & game_id = (${igdbIds.join(',')});`,
    `limit ${IGDB_PAGE_SIZE};`,
    `offset ${offset};`,
    'sort id asc;',
  ].join(' ')
}
