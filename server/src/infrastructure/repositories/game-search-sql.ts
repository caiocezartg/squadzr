import { sql, type SQL } from 'drizzle-orm'
import { SEARCH_TEXT_SEPARATOR } from '@domain/services/search-text'
import type { Database } from '@infrastructure/database/drizzle'
import { games } from '@infrastructure/database/schema/games'

/**
 * The minimum `word_similarity` between a term of five letters or more and a Game's
 * search text for a typo-tolerant match. 0.5 accepts an incomplete term ("valorat")
 * and a wrong letter in a long word ("counetr"), not a transposition in a short one.
 */
const SEARCH_SIMILARITY_THRESHOLD = 0.5

/**
 * The stricter minimum for a term of three or four letters. With 0.5 such a term
 * matches every word that merely starts alike: `word_similarity('lol', 'lost ark')`
 * is 0.5, so "lol" would list Lost Ark next to League of Legends.
 */
const SHORT_TERM_SIMILARITY_THRESHOLD = 0.7

/** Shorter terms match by text only: with 1 or 2 letters similarity matches almost everything. */
const MIN_SIMILARITY_TERM_LENGTH = 3

/** From this length on a term is "long" and uses {@link SEARCH_SIMILARITY_THRESHOLD}. */
const LONG_TERM_LENGTH = 5

/**
 * The `word_similarity` threshold for a normalized term, or `null` when the term
 * matches by text only. It counts characters, not UTF-16 units: a rare ideograph
 * outside the Basic Multilingual Plane (an astral character, such as 𠀀) is one letter.
 */
function similarityThresholdFor(term: string): number | null {
  const length = [...term].length
  if (length < MIN_SIMILARITY_TERM_LENGTH) return null
  return length < LONG_TERM_LENGTH ? SHORT_TERM_SIMILARITY_THRESHOLD : SEARCH_SIMILARITY_THRESHOLD
}

/** The statements a search issues, on the root connection or on a transaction handle. */
export type SearchExecutor = Pick<Database, 'select' | 'execute'>

/** The search text holds the normalized term: the Game's name or one of its aliases contains it. */
function containsTerm(term: string): SQL {
  return sql`${games.searchText} LIKE ${`%${term}%`}`
}

/**
 * The condition a Game meets to answer a normalized `term`: its search text contains
 * the term or, with `withSimilarity`, a word of it is similar enough. `<%` reads
 * `pg_trgm.word_similarity_threshold`, which {@link runGameSearch} sets on the
 * connection. It does not look at `listed`: each search decides which Games it covers.
 */
export function gameSearchMatch(term: string, withSimilarity: boolean): SQL {
  const contains = containsTerm(term)
  return withSimilarity ? sql`(${contains} OR ${term} <% ${games.searchText})` : contains
}

/**
 * The ordering that ranks the Games matching `term` by how it matched: an exact name or
 * alias, then a prefix, then a contained term, then the closest similarity.
 */
export function gameSearchRelevance(term: string): SQL[] {
  const contains = containsTerm(term)
  const similarity = sql`word_similarity(${term}, ${games.searchText})`

  return [
    sql`CASE
        WHEN ${term} = split_part(${games.searchText}, ${SEARCH_TEXT_SEPARATOR}, 1) OR ${term} = ANY(${games.aliases}) THEN 0
        WHEN starts_with(${games.searchText}, ${term}) THEN 1
        WHEN ${contains} THEN 2
        ELSE 3
      END`,
    sql`CASE WHEN ${contains} THEN 0 ELSE ${similarity} END DESC`,
  ]
}

/**
 * Runs `work` with the match of a normalized `term`. A term long enough to be typo-tolerant
 * needs the similarity threshold set for the statements that follow, so `work` runs in a
 * transaction; a shorter term matches by text only and `work` runs on `db` directly.
 * `set_config(..., true)` is `SET LOCAL` with a bound value: the setting lasts for this
 * transaction only, so it never leaks into the next user of the pooled connection.
 */
export async function runGameSearch<T>(
  db: Database,
  term: string,
  work: (executor: SearchExecutor, withSimilarity: boolean) => Promise<T>
): Promise<T> {
  const threshold = similarityThresholdFor(term)
  if (threshold === null) return work(db, false)

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(threshold)}, true)`
    )
    return work(tx, true)
  })
}
