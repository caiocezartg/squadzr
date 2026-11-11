/** IGDB game-mode ids that make a game formable in a Squad. */
const CANDIDATE_GAME_MODES = [2, 3, 5, 6] as const
// 2 Multiplayer, 3 Co-operative, 5 MMO, 6 Battle Royale.

/** IGDB game-type ids that are real games, not DLCs, bundles or editions. */
const CANDIDATE_GAME_TYPES = [0, 4, 8, 9, 10] as const
// 0 Main game, 4 Standalone expansion, 8 Remake, 9 Remaster, 10 Expanded game.

export const IGDB_PAGE_SIZE = 500

/**
 * A game released within this many days enters the catalog on hype alone, before
 * it gathers {@link GamesPageQueryInput.popularityThreshold} ratings (#101).
 */
export const RECENT_RELEASE_WINDOW_DAYS = 180

const SECONDS_PER_DAY = 24 * 60 * 60

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
  'alternative_names.name',
  'platforms',
  'multiplayer_modes.onlinecoopmax',
  'multiplayer_modes.onlinemax',
  'first_release_date',
  'total_rating_count',
].join(',')

export interface GamesPageQueryInput {
  /** Minimum `total_rating_count` a game needs to become a candidate. */
  readonly popularityThreshold: number
  /** Minimum `hypes` a game released since `recentReleaseSince` needs to skip the rating count. */
  readonly hypeThreshold: number
  /** Inclusive start of the recent-release window. */
  readonly recentReleaseSince: Date
  /** Exclusive upper bound of the first release date. */
  readonly releasedBefore: Date
  readonly offset: number
}

/** The start of the recent-release window that ends at `releasedBefore`. */
export function recentReleaseWindowStart(releasedBefore: Date): Date {
  return new Date(releasedBefore.getTime() - RECENT_RELEASE_WINDOW_DAYS * SECONDS_PER_DAY * 1000)
}

function fieldsClause(): string {
  return `fields ${GAME_FIELDS};`
}

/**
 * One page of the candidate query: every filter of the Catalog Import lives
 * here so the IGDB endpoint, not the adapter, narrows the catalog. A game is
 * admitted by its ratings, or by its hype when it was released in the recent
 * window and has not gathered ratings yet.
 */
export function buildGamesPageQuery(input: GamesPageQueryInput): string {
  const releasedBeforeSeconds = Math.floor(input.releasedBefore.getTime() / 1000)
  const recentReleaseSinceSeconds = Math.floor(input.recentReleaseSince.getTime() / 1000)

  return [
    fieldsClause(),
    `where game_modes = (${CANDIDATE_GAME_MODES.join(',')}) & game_type = (${CANDIDATE_GAME_TYPES.join(',')}) & version_parent = null & cover != null & slug != null & first_release_date < ${releasedBeforeSeconds} & (total_rating_count >= ${input.popularityThreshold} | (first_release_date >= ${recentReleaseSinceSeconds} & hypes >= ${input.hypeThreshold}));`,
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
