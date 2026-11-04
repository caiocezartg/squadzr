import { afterEach, describe, expect, it, vi } from 'vitest'
import { FakeClock } from '@test/harness/clock'
import recordedPage from '@test/fixtures/igdb-recorded-page.json'
import {
  IgdbGameCatalogSource,
  IgdbRequestError,
  isSearchableAlternativeName,
} from './igdb-game-catalog-source'

// CCC-90: the IGDB adapter is the only code that talks to IGDB. These tests stub
// `fetch` (as the Discord sign-in suite does) and inject a clock, so neither the
// network nor real time is involved.

const NOW = new Date('2026-10-23T12:00:00.000Z')
const RELEASED_BEFORE_SECONDS = Math.floor(NOW.getTime() / 1000)
const DAY_MS = 24 * 60 * 60 * 1000
// #101: the recent-release window opens 180 days before the run's `NOW`.
const RECENT_RELEASE_SINCE_SECONDS = Math.floor((NOW.getTime() - 180 * DAY_MS) / 1000)
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
const GAMES_URL = 'https://api.igdb.com/v4/games'
const PRIMITIVES_URL = 'https://api.igdb.com/v4/popularity_primitives'
const PAGE_SIZE = 500

interface RecordedRequest {
  readonly url: string
  readonly init: RequestInit
  readonly at: number
}

type Responder = (request: RecordedRequest, index: number) => Response | Promise<Response>

interface HarnessOptions {
  readonly curatedIgdbIds?: readonly number[]
  readonly popularityThreshold?: number
  readonly hypeThreshold?: number
  /** Answers the popularity primitives requests; no signals by default. */
  readonly primitives?: Responder
}

function tokenResponse(): Response {
  return Response.json({
    access_token: 'app-access-token',
    expires_in: 3_600,
    token_type: 'bearer',
  })
}

function game(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 2000,
    name: 'Game 2000',
    slug: 'game-2000',
    cover: { id: 9000, image_id: 'cover-2000' },
    genres: [{ id: 12, name: 'Role-playing (RPG)', slug: 'role-playing-rpg' }],
    multiplayer_modes: [{ onlinecoopmax: 4, onlinemax: 8 }],
    first_release_date: 1_600_000_000,
    total_rating_count: 120,
    ...overrides,
  }
}

function createHarness(respond: Responder, options: HarnessOptions = {}) {
  const clock = new FakeClock(NOW)
  const requests: RecordedRequest[] = []
  const sleeps: number[] = []

  const fetch = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const request = { url, init, at: clock.now().getTime() }
    requests.push(request)
    const index = requests.length - 1
    if (url === PRIMITIVES_URL)
      return (options.primitives ?? (() => Response.json([])))(request, index)
    return respond(request, index)
  })
  vi.stubGlobal('fetch', fetch)

  const source = new IgdbGameCatalogSource({
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    popularityThreshold: options.popularityThreshold ?? 42,
    hypeThreshold: options.hypeThreshold ?? 30,
    curatedIgdbIds: options.curatedIgdbIds ?? [],
    clock,
    sleep: async (ms) => {
      sleeps.push(ms)
      clock.advance(ms)
    },
  })

  return { clock, requests, sleeps, source, fetch }
}

function tokenRequests(requests: readonly RecordedRequest[]): RecordedRequest[] {
  return requests.filter((request) => request.url === TOKEN_URL)
}

function gamesRequests(requests: readonly RecordedRequest[]): RecordedRequest[] {
  return requests.filter((request) => request.url === GAMES_URL)
}

function primitivesRequests(requests: readonly RecordedRequest[]): RecordedRequest[] {
  return requests.filter((request) => request.url === PRIMITIVES_URL)
}

function bodyOf(request: RecordedRequest): string {
  return String(request.init.body)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('IgdbGameCatalogSource', () => {
  it('requests one app access token per run and maps a game, including both cover URLs', async () => {
    const harness = createHarness(
      (request) => (request.url === TOKEN_URL ? tokenResponse() : Response.json([game()])),
      {
        primitives: () =>
          Response.json([
            { id: 1, game_id: 2000, popularity_type: 3, value: 12.5 },
            { id: 2, game_id: 2000, popularity_type: 5, value: 48_000 },
          ]),
      }
    )

    const result = await harness.source.fetchCandidates()

    expect(tokenRequests(harness.requests)).toHaveLength(1)
    const token = tokenRequests(harness.requests)[0]!
    expect(token.init.method).toBe('POST')
    const tokenBody = new URLSearchParams(bodyOf(token))
    expect(tokenBody.get('client_id')).toBe('test-client-id')
    expect(tokenBody.get('client_secret')).toBe('test-client-secret')
    expect(tokenBody.get('grant_type')).toBe('client_credentials')

    const page = gamesRequests(harness.requests)[0]!
    expect(page.init.method).toBe('POST')
    expect(new Headers(page.init.headers).get('Client-ID')).toBe('test-client-id')
    expect(new Headers(page.init.headers).get('Authorization')).toBe('Bearer app-access-token')

    expect(result.candidates).toEqual([
      {
        igdbId: 2000,
        name: 'Game 2000',
        slug: 'game-2000',
        genres: [{ slug: 'role-playing-rpg', name: 'Role-playing (RPG)' }],
        platforms: [],
        aliases: [],
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cover-2000.jpg',
        thumbnailUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_small_2x/cover-2000.jpg',
        multiplayer: { onlineCoopMax: 4, onlineMax: 8 },
        popularitySignals: { playing: 12.5, steamPeakPlayers: 48_000 },
      },
    ])
    expect(result.invalid).toBe(0)
  })

  it('pages in batches of 500 until a short page, with one token for the whole run', async () => {
    const firstPage = Array.from({ length: PAGE_SIZE }, (_, index) =>
      game({ id: 3000 + index, name: `Game ${3000 + index}`, slug: `game-${3000 + index}` })
    )
    const harness = createHarness((request) => {
      if (request.url === TOKEN_URL) return tokenResponse()
      return bodyOf(request).includes('offset 0;')
        ? Response.json(firstPage)
        : Response.json([game({ id: 9999, name: 'Last Game', slug: 'last-game' })])
    })

    const { candidates } = await harness.source.fetchCandidates()

    const pages = gamesRequests(harness.requests)
    expect(pages).toHaveLength(2)
    expect(bodyOf(pages[0]!)).toContain('offset 0;')
    expect(bodyOf(pages[1]!)).toContain('offset 500;')
    expect(candidates).toHaveLength(PAGE_SIZE + 1)
    expect(candidates.at(-1)?.igdbId).toBe(9999)
    expect(tokenRequests(harness.requests)).toHaveLength(1)
  })

  it('paces requests at or below 4 per second, measured with the injected clock', async () => {
    const harness = createHarness((request) => {
      if (request.url === TOKEN_URL) return tokenResponse()
      return bodyOf(request).includes('offset 0;')
        ? Response.json(Array.from({ length: PAGE_SIZE }, (_, index) => game({ id: 4000 + index })))
        : Response.json([game({ id: 9999 })])
    })

    await harness.source.fetchCandidates()

    // Token, two games pages and the popularity primitives (501 ids = 3 batches).
    const instants = harness.requests.map((request) => request.at)
    expect(instants).toHaveLength(6)
    for (let index = 1; index < instants.length; index += 1) {
      expect(instants[index]! - instants[index - 1]!).toBeGreaterThanOrEqual(250)
    }
    expect(harness.sleeps).toEqual([250, 250, 250, 250, 250])
  })

  it('retries 429 and 5xx with bounded backoff, then succeeds', async () => {
    let attempts = 0
    const harness = createHarness((request) => {
      if (request.url === TOKEN_URL) return tokenResponse()
      attempts += 1
      if (attempts === 1) return new Response('slow down', { status: 429 })
      if (attempts === 2) return new Response('unavailable', { status: 503 })
      return Response.json([game()])
    })

    const { candidates } = await harness.source.fetchCandidates()

    expect(attempts).toBe(3)
    expect(candidates).toHaveLength(1)
    // 250ms is the pacing wait before the first page and again before the popularity
    // primitives; 500ms and 1000ms are backoff.
    expect(harness.sleeps).toEqual([250, 500, 1_000, 250])
  })

  it('fails after the retry budget when a page keeps returning 429', async () => {
    let attempts = 0
    const harness = createHarness((request) => {
      if (request.url === TOKEN_URL) return tokenResponse()
      attempts += 1
      return new Response('slow down', { status: 429 })
    })

    await expect(harness.source.fetchCandidates()).rejects.toMatchObject({
      name: 'IgdbRequestError',
      status: 429,
    })

    expect(attempts).toBe(4)
    expect(harness.sleeps).toEqual([250, 500, 1_000, 2_000])
  })

  it('fails immediately on a status that is neither 429 nor 5xx', async () => {
    let attempts = 0
    const harness = createHarness((request) => {
      if (request.url === TOKEN_URL) return tokenResponse()
      attempts += 1
      return new Response('unauthorized', { status: 401 })
    })

    await expect(harness.source.fetchCandidates()).rejects.toEqual(
      new IgdbRequestError(GAMES_URL, 401, 'unauthorized')
    )
    expect(attempts).toBe(1)
  })

  it('sends the filter, the thresholds and the curated ids in the IGDB query', async () => {
    const harness = createHarness(
      (request) => {
        if (request.url === TOKEN_URL) return tokenResponse()
        return bodyOf(request).includes('where id =')
          ? Response.json([game({ id: 1036, name: 'Curated Game', slug: 'curated-game' })])
          : Response.json([])
      },
      { popularityThreshold: 42, hypeThreshold: 30, curatedIgdbIds: [1036, 235_288] }
    )

    const { candidates } = await harness.source.fetchCandidates()

    const [filtered, curated] = gamesRequests(harness.requests)
    expect(bodyOf(filtered!)).toContain('game_modes = (2,3,5,6)')
    expect(bodyOf(filtered!)).toContain('game_type = (0,4,8,9,10)')
    expect(bodyOf(filtered!)).toContain('version_parent = null')
    expect(bodyOf(filtered!)).toContain('cover != null')
    expect(bodyOf(filtered!)).toContain('slug != null')
    expect(bodyOf(filtered!)).toContain(`first_release_date < ${RELEASED_BEFORE_SECONDS}`)
    expect(bodyOf(filtered!)).toContain(
      `(total_rating_count >= 42 | (first_release_date >= ${RECENT_RELEASE_SINCE_SECONDS} & hypes >= 30))`
    )
    expect(bodyOf(filtered!)).toContain('limit 500;')
    expect(bodyOf(filtered!)).toContain('sort id asc;')

    expect(bodyOf(curated!)).toContain('where id = (1036,235288);')
    expect(bodyOf(curated!)).not.toContain('total_rating_count >=')
    expect(bodyOf(curated!)).not.toContain('hypes')
    expect(bodyOf(curated!)).not.toContain('first_release_date >=')

    expect(candidates.map((candidate) => candidate.igdbId)).toEqual([1036])
  })

  it('sends a hype threshold of 0 as the floor of the window, admitting every recent release', async () => {
    const harness = createHarness(
      (request) => (request.url === TOKEN_URL ? tokenResponse() : Response.json([])),
      { hypeThreshold: 0 }
    )

    await harness.source.fetchCandidates()

    expect(bodyOf(gamesRequests(harness.requests)[0]!)).toContain(
      `(first_release_date >= ${RECENT_RELEASE_SINCE_SECONDS} & hypes >= 0)`
    )
  })

  it('reads the clock once per run, so every page filters on the same window', async () => {
    const firstPage = Array.from({ length: PAGE_SIZE }, (_, index) =>
      game({ id: 6000 + index, name: `Game ${6000 + index}`, slug: `game-${6000 + index}` })
    )
    const harness = createHarness((request) => {
      if (request.url === TOKEN_URL) return tokenResponse()
      const isFirstPage = bodyOf(request).includes('offset 0;')
      // Time moves on between the pages; the second one must not see it.
      if (isFirstPage) harness.clock.advance(2 * DAY_MS)
      return isFirstPage ? Response.json(firstPage) : Response.json([game({ id: 9998 })])
    })

    await harness.source.fetchCandidates()

    const pages = gamesRequests(harness.requests)
    expect(pages).toHaveLength(2)
    for (const page of pages) {
      expect(bodyOf(page)).toContain(`first_release_date < ${RELEASED_BEFORE_SECONDS} &`)
      expect(bodyOf(page)).toContain(
        `(first_release_date >= ${RECENT_RELEASE_SINCE_SECONDS} & hypes >= 30)`
      )
    }
  })

  it('maps a recorded page and counts the candidates missing their name, slug or cover', async () => {
    const harness = createHarness((request) =>
      request.url === TOKEN_URL ? tokenResponse() : Response.json(recordedPage)
    )

    const result = await harness.source.fetchCandidates()

    expect(result.candidates).toHaveLength(6)
    expect(result.candidates[0]).toEqual({
      igdbId: 5,
      name: "Baldur's Gate",
      slug: 'baldur-s-gate',
      genres: [{ slug: 'role-playing-rpg', name: 'Role-playing (RPG)' }],
      platforms: [],
      aliases: [],
      coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co20gb.jpg',
      thumbnailUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_small_2x/co20gb.jpg',
      multiplayer: { onlineCoopMax: null, onlineMax: null },
      popularitySignals: { playing: null, steamPeakPlayers: null },
    })
    // The recorded page has online co-op but no online maximum.
    expect(result.candidates[1]).toMatchObject({
      igdbId: 6,
      multiplayer: { onlineCoopMax: 6, onlineMax: null },
    })
    // The recorded page's no-genres record survives with an empty list and
    // unknown multiplayer capacity; only name, slug or cover are required.
    expect(result.candidates[5]).toMatchObject({
      igdbId: 134710,
      genres: [],
      multiplayer: { onlineCoopMax: null, onlineMax: null },
      popularitySignals: { playing: null, steamPeakPlayers: null },
    })
    expect(result.invalid).toBe(3)
  })

  it('reads the alternative names of a recorded page: present, empty and absent', async () => {
    const harness = createHarness((request) =>
      request.url === TOKEN_URL ? tokenResponse() : Response.json(recordedPage)
    )

    const { candidates } = await harness.source.fetchCandidates()

    const aliasesOf = (igdbId: number) =>
      candidates.find((candidate) => candidate.igdbId === igdbId)?.aliases
    expect(aliasesOf(134710)).toEqual(['GTAO', 'GTA Online'])
    expect(aliasesOf(6)).toEqual([])
    expect(aliasesOf(5)).toEqual([])
  })

  it('asks IGDB for the alternative names of every game', async () => {
    const harness = createHarness((request) =>
      request.url === TOKEN_URL ? tokenResponse() : Response.json([game()])
    )

    await harness.source.fetchCandidates()

    expect(bodyOf(gamesRequests(harness.requests)[0]!)).toContain(',alternative_names.name,')
  })

  it('keeps the trimmed alternative names and drops the blank and null ones', async () => {
    const harness = createHarness((request) =>
      request.url === TOKEN_URL
        ? tokenResponse()
        : Response.json([
            game({
              id: 91,
              alternative_names: [
                { id: 1, name: '  LoL ' },
                { id: 2, name: '   ' },
                { id: 3, name: null },
                { id: 4 },
                { id: 5, name: 'Legends' },
              ],
            }),
            game({ id: 92, name: 'Game 92', slug: 'game-92', alternative_names: null }),
          ])
    )

    const { candidates } = await harness.source.fetchCandidates()

    expect(candidates.map((candidate) => [candidate.igdbId, candidate.aliases])).toEqual([
      [91, ['LoL', 'Legends']],
      [92, []],
    ])
  })

  it('drops executable names and paths from the alternative names, and keeps the acronyms', async () => {
    const harness = createHarness((request) =>
      request.url === TOKEN_URL
        ? tokenResponse()
        : Response.json([
            game({
              id: 94,
              alternative_names: [
                { id: 1, name: 'CS2' },
                { id: 2, name: 'cs2.exe' },
                { id: 3, name: 'RainbowSix.exe' },
                { id: 4, name: 'R6S' },
                { id: 5, name: 'DeadByDaylight.exe' },
                { id: 6, name: 'DBD' },
                { id: 7, name: 'TslGame\\Binaries\\Win64\\ExecPubg.exe' },
                { id: 8, name: ' Steam/Linux.sh ' },
              ],
            }),
          ])
    )

    const { candidates } = await harness.source.fetchCandidates()

    expect(candidates[0]?.aliases).toEqual(['CS2', 'R6S', 'DBD'])
  })

  it('fails the run when a games page carries a malformed alternative_names list', async () => {
    const harness = createHarness((request) =>
      request.url === TOKEN_URL
        ? tokenResponse()
        : Response.json([game({ id: 93, alternative_names: ['CS2'] })])
    )

    await expect(harness.source.fetchCandidates()).rejects.toThrow('Invalid IGDB games page')
  })

  it('asks IGDB for the platform ids of every game', async () => {
    const harness = createHarness((request) =>
      request.url === TOKEN_URL ? tokenResponse() : Response.json([game()])
    )

    await harness.source.fetchCandidates()

    expect(bodyOf(gamesRequests(harness.requests)[0]!)).toContain(',platforms,')
  })

  it('maps IGDB platform ids to the supported platforms, deduplicated and in display order', async () => {
    const harness = createHarness((request) =>
      request.url === TOKEN_URL
        ? tokenResponse()
        : Response.json([
            // Windows, Mac and Linux collapse into one PC; PS3 (9), Xbox 360 (12) and
            // Wii U (41) are not in the list; the order of IGDB is not the display order.
            game({ id: 61, platforms: [130, 39, 6, 14, 3, 48, 9, 12, 41, 169, 167, 34, 49, 508] }),
          ])
    )

    const { candidates } = await harness.source.fetchCandidates()

    expect(candidates[0]?.platforms).toEqual([
      'pc',
      'ps5',
      'ps4',
      'xbox-series',
      'xbox-one',
      'switch-2',
      'switch',
      'mobile',
    ])
  })

  it('keeps a game with no supported platform, with an empty list', async () => {
    const harness = createHarness((request) =>
      request.url === TOKEN_URL
        ? tokenResponse()
        : Response.json([
            game({ id: 71, platforms: [9, 12, 41] }),
            game({ id: 72, name: 'Game 72', slug: 'game-72', platforms: [] }),
            game({ id: 73, name: 'Game 73', slug: 'game-73', platforms: null }),
            game({ id: 74, name: 'Game 74', slug: 'game-74' }),
          ])
    )

    const result = await harness.source.fetchCandidates()

    expect(result.candidates.map((candidate) => [candidate.igdbId, candidate.platforms])).toEqual([
      [71, []],
      [72, []],
      [73, []],
      [74, []],
    ])
    expect(result.invalid).toBe(0)
  })

  it('fails the run when a games page carries a malformed platforms list', async () => {
    const harness = createHarness((request) =>
      request.url === TOKEN_URL
        ? tokenResponse()
        : Response.json([game({ id: 81, platforms: ['pc'] })])
    )

    await expect(harness.source.fetchCandidates()).rejects.toThrow('Invalid IGDB games page')
  })

  it('queries the Playing and Steam Peak primitives of the candidates with the run token', async () => {
    const harness = createHarness((request) =>
      request.url === TOKEN_URL
        ? tokenResponse()
        : Response.json([game({ id: 11 }), game({ id: 12, name: 'Game 12', slug: 'game-12' })])
    )

    await harness.source.fetchCandidates()

    const [primitives] = primitivesRequests(harness.requests)
    expect(primitivesRequests(harness.requests)).toHaveLength(1)
    expect(primitives!.init.method).toBe('POST')
    expect(new Headers(primitives!.init.headers).get('Client-ID')).toBe('test-client-id')
    expect(new Headers(primitives!.init.headers).get('Authorization')).toBe(
      'Bearer app-access-token'
    )
    expect(bodyOf(primitives!)).toBe(
      'fields game_id,popularity_type,value; where popularity_type = (3,5) & game_id = (11,12); limit 500; offset 0; sort id asc;'
    )
    expect(tokenRequests(harness.requests)).toHaveLength(1)
  })

  it('splits the primitives query into batches of at most 250 ids', async () => {
    const harness = createHarness((request) => {
      if (request.url === TOKEN_URL) return tokenResponse()
      return bodyOf(request).includes('offset 0;')
        ? Response.json(Array.from({ length: PAGE_SIZE }, (_, index) => game({ id: 100 + index })))
        : Response.json([game({ id: 700 })])
    })

    await harness.source.fetchCandidates()

    const batches = primitivesRequests(harness.requests).map((request) => {
      const ids = /game_id = \(([\d,]+)\)/.exec(bodyOf(request))![1]!.split(',')
      return ids.length
    })
    expect(batches).toEqual([250, 250, 1])
  })

  it('pages a primitives batch until a short page, so rows past the 500-row limit are kept', async () => {
    const harness = createHarness(
      (request) =>
        request.url === TOKEN_URL
          ? tokenResponse()
          : Response.json([game({ id: 51 }), game({ id: 52, name: 'Game 52', slug: 'game-52' })]),
      {
        primitives: (request) =>
          bodyOf(request).includes('offset 0;')
            ? Response.json(
                Array.from({ length: PAGE_SIZE }, (_, index) => ({
                  game_id: 51,
                  popularity_type: 3,
                  value: index,
                }))
              )
            : Response.json([{ game_id: 52, popularity_type: 5, value: 4_000 }]),
      }
    )

    const { candidates } = await harness.source.fetchCandidates()

    expect(
      primitivesRequests(harness.requests).map(
        (request) => /offset (\d+);/.exec(bodyOf(request))![1]
      )
    ).toEqual(['0', '500'])
    expect(candidates.map((candidate) => [candidate.igdbId, candidate.popularitySignals])).toEqual([
      [51, { playing: PAGE_SIZE - 1, steamPeakPlayers: null }],
      [52, { playing: null, steamPeakPlayers: 4_000 }],
    ])
  })

  it('does not query primitives for games that were dropped as invalid or when there are none', async () => {
    const harness = createHarness((request) =>
      request.url === TOKEN_URL
        ? tokenResponse()
        : Response.json([game({ id: 21, cover: null }), game({ id: 22, name: null })])
    )

    const result = await harness.source.fetchCandidates()

    expect(result.candidates).toEqual([])
    expect(result.invalid).toBe(2)
    expect(primitivesRequests(harness.requests)).toHaveLength(0)
  })

  it('maps each game to its own signals, with null for the ones IGDB does not have', async () => {
    const harness = createHarness(
      (request) =>
        request.url === TOKEN_URL
          ? tokenResponse()
          : Response.json([
              game({ id: 31 }),
              game({ id: 32, name: 'Game 32', slug: 'game-32' }),
              game({ id: 33, name: 'Game 33', slug: 'game-33' }),
              game({ id: 34, name: 'Game 34', slug: 'game-34' }),
            ]),
      {
        primitives: () =>
          Response.json([
            { game_id: 31, popularity_type: 3, value: 80.25 },
            { game_id: 31, popularity_type: 5, value: 1_200 },
            { game_id: 32, popularity_type: 3, value: 5 },
            { game_id: 33, popularity_type: 5, value: 30_000 },
            { game_id: 999, popularity_type: 3, value: 1 },
            { game_id: 34, popularity_type: 1, value: 77 },
          ]),
      }
    )

    const { candidates } = await harness.source.fetchCandidates()

    expect(candidates.map((candidate) => [candidate.igdbId, candidate.popularitySignals])).toEqual([
      [31, { playing: 80.25, steamPeakPlayers: 1_200 }],
      [32, { playing: 5, steamPeakPlayers: null }],
      [33, { playing: null, steamPeakPlayers: 30_000 }],
      [34, { playing: null, steamPeakPlayers: null }],
    ])
  })

  it('keeps the highest value when a game has several rows of the same type', async () => {
    const harness = createHarness(
      (request) =>
        request.url === TOKEN_URL ? tokenResponse() : Response.json([game({ id: 41 })]),
      {
        primitives: () =>
          Response.json([
            { game_id: 41, popularity_type: 3, value: 10 },
            { game_id: 41, popularity_type: 3, value: 90.5 },
            { game_id: 41, popularity_type: 3, value: 30 },
            { game_id: 41, popularity_type: 5, value: 700 },
            { game_id: 41, popularity_type: 5, value: 200 },
          ]),
      }
    )

    const { candidates } = await harness.source.fetchCandidates()

    expect(candidates[0]?.popularitySignals).toEqual({ playing: 90.5, steamPeakPlayers: 700 })
  })

  it('fails when a primitives page is malformed', async () => {
    const harness = createHarness(
      (request) => (request.url === TOKEN_URL ? tokenResponse() : Response.json([game()])),
      { primitives: () => Response.json([{ game_id: 2000, popularity_type: 3, value: 'many' }]) }
    )

    await expect(harness.source.fetchCandidates()).rejects.toThrow(
      'Invalid IGDB popularity primitives page'
    )
  })

  it('retries the primitives request on 429 with the same token', async () => {
    let primitiveAttempts = 0
    const harness = createHarness(
      (request) => (request.url === TOKEN_URL ? tokenResponse() : Response.json([game()])),
      {
        primitives: () => {
          primitiveAttempts += 1
          return primitiveAttempts === 1
            ? new Response('slow down', { status: 429 })
            : Response.json([{ game_id: 2000, popularity_type: 3, value: 3 }])
        },
      }
    )

    const { candidates } = await harness.source.fetchCandidates()

    expect(primitiveAttempts).toBe(2)
    expect(candidates[0]?.popularitySignals.playing).toBe(3)
    expect(tokenRequests(harness.requests)).toHaveLength(1)
    expect(
      primitivesRequests(harness.requests).map((request) =>
        new Headers(request.init.headers).get('Authorization')
      )
    ).toEqual(['Bearer app-access-token', 'Bearer app-access-token'])
  })

  it('fails when the token response is malformed', async () => {
    const harness = createHarness(() => Response.json({ token: 'not-an-access-token' }))

    await expect(harness.source.fetchCandidates()).rejects.toThrow('Invalid IGDB token response')
    expect(gamesRequests(harness.requests)).toHaveLength(0)
  })

  it('fails when a games page is malformed', async () => {
    const harness = createHarness((request) =>
      request.url === TOKEN_URL ? tokenResponse() : Response.json({ games: [] })
    )

    await expect(harness.source.fetchCandidates()).rejects.toThrow('Invalid IGDB games page')
  })
})

// #106: IGDB lists executable names and paths as alternative names; they are not aliases a
// player types.
describe('isSearchableAlternativeName', () => {
  it.each(['CS2', 'R6S', 'DBD', 'GTA Online', 'Half-Life 2: Episode 1', 'Mac.App Store', 'sh'])(
    'keeps %s',
    (name) => {
      expect(isSearchableAlternativeName(name)).toBe(true)
    }
  )

  it.each([
    'cs2.exe',
    'RainbowSix.exe',
    'DeadByDaylight.exe',
    'TslGame\\Binaries\\Win64\\ExecPubg.exe',
    'GAME.EXE',
    'Game.App',
    'installer.bin',
    'launch.sh',
    'Fate/Grand Order',
    'C:\\Games\\Foo',
    'bin/foo',
  ])('drops %s', (name) => {
    expect(isSearchableAlternativeName(name)).toBe(false)
  })
})
