import { z } from 'zod'
import type { Clock } from '@domain/services/clock.interface'
import type {
  GameCatalogCandidate,
  GameCatalogFetchResult,
  GameMultiplayerCapacity,
  IGameCatalogSource,
} from '@domain/services/game-catalog-source.interface'
import {
  igdbGamesPageSchema,
  igdbTokenResponseSchema,
  type IgdbGame,
} from '@infrastructure/igdb/igdb.schemas'
import {
  buildCuratedGamesQuery,
  buildGamesPageQuery,
  IGDB_PAGE_SIZE,
} from '@infrastructure/igdb/igdb-queries'
import { RequestPacer, defaultSleep, type Sleep } from '@infrastructure/igdb/request-pacer'

const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
const IGDB_GAMES_URL = 'https://api.igdb.com/v4/games'
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
  /** Curated games fetched by id even when they miss the threshold. */
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

function imageUrl(imageId: string, size: 'cover_big_2x' | 'cover_small_2x'): string {
  return `${IGDB_IMAGE_BASE_URL}/t_${size}/${imageId}.jpg`
}

/**
 * The IGDB implementation of the Game Catalog Source (CCC-90): one Twitch app
 * access token per run, paced and retried IGDB v4 games pages, and IGDB image
 * URLs. This is the only module that talks to IGDB or builds IGDB URLs.
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
    const filtered = await this.fetchFilteredGames(accessToken)
    const curated = await this.fetchCuratedGames(accessToken)

    const byIgdbId = new Map<number, GameCatalogCandidate>()
    for (const game of [...filtered, ...curated]) {
      const candidate = this.toCandidate(game)
      if (candidate && !byIgdbId.has(candidate.igdbId)) {
        byIgdbId.set(candidate.igdbId, candidate)
      }
    }

    return { candidates: [...byIgdbId.values()], invalid: this.invalidCandidates }
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

  /** Walks the candidate query in pages of 500 until a short page. */
  private async fetchFilteredGames(accessToken: string): Promise<IgdbGame[]> {
    const games: IgdbGame[] = []

    for (let offset = 0; ; offset += IGDB_PAGE_SIZE) {
      const query = buildGamesPageQuery({
        threshold: this.options.popularityThreshold,
        releasedBefore: this.options.clock.now(),
        offset,
      })
      const page = await this.requestGamesPage(accessToken, query)
      games.push(...page)
      if (page.length < IGDB_PAGE_SIZE) return games
    }
  }

  /** The curated ids in one explicit query, bypassing the threshold. */
  private async fetchCuratedGames(accessToken: string): Promise<IgdbGame[]> {
    if (this.options.curatedIgdbIds.length === 0) return []
    const query = buildCuratedGamesQuery(this.options.curatedIgdbIds)
    return this.requestGamesPage(accessToken, query)
  }

  private async requestGamesPage(accessToken: string, query: string): Promise<IgdbGame[]> {
    const response = await this.requestWithRetry(IGDB_GAMES_URL, {
      method: 'POST',
      headers: {
        'Client-ID': this.options.clientId,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'text/plain',
        Accept: 'application/json',
      },
      body: query,
    })

    const payload: unknown = await response.json()
    const parsed = igdbGamesPageSchema.safeParse(payload)
    if (!parsed.success) {
      throw new Error(`Invalid IGDB games page: ${z.prettifyError(parsed.error)}`)
    }
    return parsed.data
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
  private toCandidate(game: IgdbGame): GameCatalogCandidate | null {
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
      coverUrl: imageUrl(imageId, 'cover_big_2x'),
      thumbnailUrl: imageUrl(imageId, 'cover_small_2x'),
      multiplayer: toMultiplayerCapacity(game),
      popularity: game.total_rating_count ?? 0,
    }
  }
}
