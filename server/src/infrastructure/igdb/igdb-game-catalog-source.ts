import { platformsFromIgdbIds } from '@squadzr/schemas'
import { z } from 'zod'
import type { Clock } from '@domain/services/clock.interface'
import type {
  GameCatalogCandidate,
  GameCatalogFetchResult,
  GameMultiplayerCapacity,
  GamePopularitySignals,
  IGameCatalogSource,
} from '@domain/services/game-catalog-source.interface'
import {
  igdbGamesPageSchema,
  igdbPopularityPrimitivesPageSchema,
  igdbTokenResponseSchema,
  type IgdbGame,
  type IgdbPopularityPrimitive,
} from '@infrastructure/igdb/igdb.schemas'
import {
  buildCuratedGamesQuery,
  buildGamesPageQuery,
  buildPopularityPrimitivesQuery,
  IGDB_PAGE_SIZE,
  IGDB_POPULARITY_BATCH_SIZE,
  IGDB_POPULARITY_TYPE_PLAYING,
  IGDB_POPULARITY_TYPE_STEAM_PEAK,
  recentReleaseWindowStart,
} from '@infrastructure/igdb/igdb-queries'
import { RequestPacer, defaultSleep, type Sleep } from '@infrastructure/igdb/request-pacer'

const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
const IGDB_GAMES_URL = 'https://api.igdb.com/v4/games'
const IGDB_POPULARITY_PRIMITIVES_URL = 'https://api.igdb.com/v4/popularity_primitives'
const IGDB_IMAGE_BASE_URL = 'https://images.igdb.com/igdb/image/upload'

/** A 429 or a 5xx is retried; every other status fails the run immediately. */
const MAX_RETRIES = 3
const BACKOFF_BASE_MS = 500

export type { Sleep }

export interface IgdbGameCatalogSourceOptions {
  readonly clientId: string
  readonly clientSecret: string
  /** Minimum `total_rating_count` for a non-curated game. */
  readonly popularityThreshold: number
  /**
   * Minimum `hypes` for a non-curated game released in the last 180 days to enter
   * without reaching `popularityThreshold`; 0 is no floor among the games that have
   * `hypes`, and a release without `hypes` enters only through the rating count.
   */
  readonly hypeThreshold: number
  /** Curated games fetched by id even when they miss both thresholds. */
  readonly curatedIgdbIds: readonly number[]
  readonly clock: Clock
  readonly fetch?: typeof globalThis.fetch
  readonly sleep?: Sleep
}

/** One failed IGDB/Twitch request, after the retry budget when it was retryable. */
export class IgdbRequestError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
    detail: string
  ) {
    super(`IGDB request to ${url} failed with status ${status}${detail ? `: ${detail}` : ''}`)
    this.name = 'IgdbRequestError'
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

async function responseDetail(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 300)
  } catch {
    return ''
  }
}

function largestCapacity(values: readonly (number | null | undefined)[]): number | null {
  const players = values.filter(
    (value): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0
  )
  return players.length > 0 ? Math.max(...players) : null
}

function toMultiplayerCapacity(game: IgdbGame): GameMultiplayerCapacity {
  const modes = game.multiplayer_modes ?? []
  return {
    onlineCoopMax: largestCapacity(modes.map((mode) => mode.onlinecoopmax)),
    onlineMax: largestCapacity(modes.map((mode) => mode.onlinemax)),
  }
}

const EXECUTABLE_NAME = /\.(?:exe|app|bin|sh)$/i
const PATH_SEPARATOR = /[\\/]/

/**
 * Whether an IGDB alternative name is something a player would type. IGDB also
 * lists executable names ("cs2.exe") and paths ("TslGame\Binaries\Win64\ExecPubg.exe"),
 * which would only bloat a Game's search text.
 */
export function isSearchableAlternativeName(name: string): boolean {
  return !EXECUTABLE_NAME.test(name) && !PATH_SEPARATOR.test(name)
}

/**
 * The non-blank alternative names IGDB lists for a game, trimmed and without the
 * executable names and paths; empty when the field is absent.
 */
function toAliases(game: IgdbGame): string[] {
  return (game.alternative_names ?? [])
    .map((alternative) => alternative.name?.trim() ?? '')
    .filter((name) => name !== '' && isSearchableAlternativeName(name))
}

/** A candidate before the popularity signals are fetched for it. */
type CandidateWithoutSignals = Omit<GameCatalogCandidate, 'popularitySignals'>

const NO_SIGNALS: GamePopularitySignals = { playing: null, steamPeakPlayers: null }

/** Keeps the highest value per game and type; the other types are ignored. */
function toSignalsByGame(
  rows: readonly IgdbPopularityPrimitive[]
): Map<number, GamePopularitySignals> {
  const byGame = new Map<number, GamePopularitySignals>()

  for (const row of rows) {
    const current = byGame.get(row.game_id) ?? NO_SIGNALS
    if (row.popularity_type === IGDB_POPULARITY_TYPE_PLAYING) {
      byGame.set(row.game_id, { ...current, playing: Math.max(current.playing ?? 0, row.value) })
    } else if (row.popularity_type === IGDB_POPULARITY_TYPE_STEAM_PEAK) {
      byGame.set(row.game_id, {
        ...current,
        steamPeakPlayers: Math.max(current.steamPeakPlayers ?? 0, row.value),
      })
    }
  }

  return byGame
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size))
  }
  return chunks
}

function imageUrl(imageId: string, size: 'cover_big_2x' | 'cover_small_2x'): string {
  return `${IGDB_IMAGE_BASE_URL}/t_${size}/${imageId}.jpg`
}

/**
 * The IGDB implementation of the Game Catalog Source (CCC-90): one Twitch app
 * access token per run, paced and retried IGDB v4 games pages, the popularity
 * primitives of every candidate, and IGDB image URLs. This is the only module
 * that talks to IGDB or builds IGDB URLs.
 */
export class IgdbGameCatalogSource implements IGameCatalogSource {
  private readonly fetchImpl: typeof globalThis.fetch
  private readonly pacer: RequestPacer
  private invalidCandidates = 0

  constructor(private readonly options: IgdbGameCatalogSourceOptions) {
    this.fetchImpl = options.fetch ?? globalThis.fetch
    this.pacer = new RequestPacer(options.clock, options.sleep)
  }

  async fetchCandidates(): Promise<GameCatalogFetchResult> {
    this.invalidCandidates = 0
    const accessToken = await this.requestAccessToken()
    const releasedBefore = this.options.clock.now()
    const filtered = await this.fetchFilteredGames(accessToken, releasedBefore)
    const curated = await this.fetchCuratedGames(accessToken)

    const byIgdbId = new Map<number, CandidateWithoutSignals>()
    for (const game of [...filtered, ...curated]) {
      const candidate = this.toCandidate(game)
      if (candidate && !byIgdbId.has(candidate.igdbId)) {
        byIgdbId.set(candidate.igdbId, candidate)
      }
    }

    const signals = await this.fetchPopularitySignals(accessToken, [...byIgdbId.keys()])
    const candidates = [...byIgdbId.values()].map((candidate) => ({
      ...candidate,
      popularitySignals: signals.get(candidate.igdbId) ?? NO_SIGNALS,
    }))

    return { candidates, invalid: this.invalidCandidates }
  }

  /** One client-credentials token per run; it lives in this call only. */
  private async requestAccessToken(): Promise<string> {
    const response = await this.requestWithRetry(TWITCH_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.options.clientId,
        client_secret: this.options.clientSecret,
        grant_type: 'client_credentials',
      }).toString(),
    })

    const payload: unknown = await response.json()
    const parsed = igdbTokenResponseSchema.safeParse(payload)
    if (!parsed.success) {
      throw new Error(`Invalid IGDB token response: ${z.prettifyError(parsed.error)}`)
    }
    return parsed.data.access_token
  }

  /**
   * Walks the candidate query in pages of 500 until a short page. The run's single
   * `releasedBefore` fixes the recent-release window, so every page filters alike.
   */
  private async fetchFilteredGames(accessToken: string, releasedBefore: Date): Promise<IgdbGame[]> {
    const games: IgdbGame[] = []
    const recentReleaseSince = recentReleaseWindowStart(releasedBefore)

    for (let offset = 0; ; offset += IGDB_PAGE_SIZE) {
      const query = buildGamesPageQuery({
        popularityThreshold: this.options.popularityThreshold,
        hypeThreshold: this.options.hypeThreshold,
        recentReleaseSince,
        releasedBefore,
        offset,
      })
      const page = await this.requestGamesPage(accessToken, query)
      games.push(...page)
      if (page.length < IGDB_PAGE_SIZE) return games
    }
  }

  /** The curated ids in one explicit query, bypassing the thresholds. */
  private async fetchCuratedGames(accessToken: string): Promise<IgdbGame[]> {
    if (this.options.curatedIgdbIds.length === 0) return []
    const query = buildCuratedGamesQuery(this.options.curatedIgdbIds)
    return this.requestGamesPage(accessToken, query)
  }

  /** Playing and Steam Peak rows of every candidate, batched by id and paged within each batch. */
  private async fetchPopularitySignals(
    accessToken: string,
    igdbIds: readonly number[]
  ): Promise<Map<number, GamePopularitySignals>> {
    const rows: IgdbPopularityPrimitive[] = []
    for (const batch of chunk(igdbIds, IGDB_POPULARITY_BATCH_SIZE)) {
      for (let offset = 0; ; offset += IGDB_PAGE_SIZE) {
        const page = await this.requestPopularityPrimitives(accessToken, batch, offset)
        rows.push(...page)
        if (page.length < IGDB_PAGE_SIZE) break
      }
    }
    return toSignalsByGame(rows)
  }

  private async requestPopularityPrimitives(
    accessToken: string,
    igdbIds: readonly number[],
    offset: number
  ): Promise<IgdbPopularityPrimitive[]> {
    const response = await this.postQuery(
      IGDB_POPULARITY_PRIMITIVES_URL,
      accessToken,
      buildPopularityPrimitivesQuery(igdbIds, offset)
    )

    const payload: unknown = await response.json()
    const parsed = igdbPopularityPrimitivesPageSchema.safeParse(payload)
    if (!parsed.success) {
      throw new Error(`Invalid IGDB popularity primitives page: ${z.prettifyError(parsed.error)}`)
    }
    return parsed.data
  }

  private async requestGamesPage(accessToken: string, query: string): Promise<IgdbGame[]> {
    const response = await this.postQuery(IGDB_GAMES_URL, accessToken, query)

    const payload: unknown = await response.json()
    const parsed = igdbGamesPageSchema.safeParse(payload)
    if (!parsed.success) {
      throw new Error(`Invalid IGDB games page: ${z.prettifyError(parsed.error)}`)
    }
    return parsed.data
  }

  /** One authenticated Apicalypse query against an IGDB v4 endpoint. */
  private postQuery(url: string, accessToken: string, query: string): Promise<Response> {
    return this.requestWithRetry(url, {
      method: 'POST',
      headers: {
        'Client-ID': this.options.clientId,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'text/plain',
        Accept: 'application/json',
      },
      body: query,
    })
  }

  /** Paces every request and retries 429/5xx with bounded exponential backoff. */
  private async requestWithRetry(url: string, init: RequestInit): Promise<Response> {
    for (let attempt = 0; ; attempt += 1) {
      await this.pacer.waitTurn()
      const response = await this.fetchImpl(url, init)

      if (response.ok) return response
      if (!isRetryableStatus(response.status) || attempt >= MAX_RETRIES) {
        throw new IgdbRequestError(url, response.status, await responseDetail(response))
      }

      await response.body?.cancel()
      await this.sleep(BACKOFF_BASE_MS * 2 ** attempt)
    }
  }

  private sleep(ms: number): Promise<void> {
    return (this.options.sleep ?? defaultSleep)(ms)
  }

  /** Maps one IGDB game, dropping and counting the ones missing name, slug or cover. */
  private toCandidate(game: IgdbGame): CandidateWithoutSignals | null {
    const name = game.name?.trim()
    const slug = game.slug?.trim()
    const imageId = game.cover?.image_id?.trim()

    if (!name || !slug || !imageId) {
      this.invalidCandidates += 1
      return null
    }

    return {
      igdbId: game.id,
      name,
      slug,
      genres: (game.genres ?? []).map((genre) => ({ slug: genre.slug, name: genre.name })),
      platforms: platformsFromIgdbIds(game.platforms ?? []),
      aliases: toAliases(game),
      coverUrl: imageUrl(imageId, 'cover_big_2x'),
      thumbnailUrl: imageUrl(imageId, 'cover_small_2x'),
      multiplayer: toMultiplayerCapacity(game),
    }
  }
}
