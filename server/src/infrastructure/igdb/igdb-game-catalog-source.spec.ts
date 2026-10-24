import { afterEach, describe, expect, it, vi } from 'vitest'
import { FakeClock } from '@test/harness/clock'
import recordedPage from '@test/fixtures/igdb-recorded-page.json'
import { IgdbGameCatalogSource, IgdbRequestError } from './igdb-game-catalog-source'

// CCC-90: the IGDB adapter is the only code that talks to IGDB. These tests stub
// `fetch` (as the Discord sign-in suite does) and inject a clock, so neither the
// network nor real time is involved.

const NOW = new Date('2026-10-23T12:00:00.000Z')
const RELEASED_BEFORE_SECONDS = Math.floor(NOW.getTime() / 1000)
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
const GAMES_URL = 'https://api.igdb.com/v4/games'
const PAGE_SIZE = 500

interface RecordedRequest {
  readonly url: string
  readonly init: RequestInit
  readonly at: number
}

type Responder = (request: RecordedRequest, index: number) => Response | Promise<Response>

interface HarnessOptions {
  readonly curatedIgdbIds?: readonly number[]
  readonly threshold?: number
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
    return respond(request, requests.length - 1)
  })
  vi.stubGlobal('fetch', fetch)

  const source = new IgdbGameCatalogSource({
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    popularityThreshold: options.threshold ?? 42,
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

function bodyOf(request: RecordedRequest): string {
  return String(request.init.body)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('IgdbGameCatalogSource', () => {
  it('requests one app access token per run and maps a game, including both cover URLs', async () => {
    const harness = createHarness((request) =>
      request.url === TOKEN_URL ? tokenResponse() : Response.json([game()])
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
        coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/cover-2000.jpg',
        thumbnailUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_small_2x/cover-2000.jpg',
        multiplayer: { onlineCoopMax: 4, onlineMax: 8 },
        popularity: 120,
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

    const instants = harness.requests.map((request) => request.at)
    expect(instants).toHaveLength(3)
    for (let index = 1; index < instants.length; index += 1) {
      expect(instants[index]! - instants[index - 1]!).toBeGreaterThanOrEqual(250)
    }
    expect(harness.sleeps).toEqual([250, 250])
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
    // 250ms is the pacing wait before the first page; 500ms and 1000ms are backoff.
    expect(harness.sleeps).toEqual([250, 500, 1_000])
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

  it('sends the filter, the threshold and the curated ids in the IGDB query', async () => {
    const harness = createHarness(
      (request) => {
        if (request.url === TOKEN_URL) return tokenResponse()
        return bodyOf(request).includes('where id =')
          ? Response.json([game({ id: 1036, name: 'Curated Game', slug: 'curated-game' })])
          : Response.json([])
      },
      { threshold: 42, curatedIgdbIds: [1036, 235_288] }
    )

    const { candidates } = await harness.source.fetchCandidates()

    const [filtered, curated] = gamesRequests(harness.requests)
    expect(bodyOf(filtered!)).toContain('game_modes = (2,3,5,6)')
    expect(bodyOf(filtered!)).toContain('game_type = (0,4,8,9,10)')
    expect(bodyOf(filtered!)).toContain('version_parent = null')
    expect(bodyOf(filtered!)).toContain('cover != null')
    expect(bodyOf(filtered!)).toContain('slug != null')
    expect(bodyOf(filtered!)).toContain(`first_release_date < ${RELEASED_BEFORE_SECONDS}`)
    expect(bodyOf(filtered!)).toContain('total_rating_count >= 42')
    expect(bodyOf(filtered!)).toContain('limit 500;')
    expect(bodyOf(filtered!)).toContain('sort id asc;')

    expect(bodyOf(curated!)).toContain('where id = (1036,235288);')
    expect(bodyOf(curated!)).not.toContain('total_rating_count >=')

    expect(candidates.map((candidate) => candidate.igdbId)).toEqual([1036])
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
      coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co20gb.jpg',
      thumbnailUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_small_2x/co20gb.jpg',
      multiplayer: { onlineCoopMax: null, onlineMax: null },
      popularity: 355,
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
      popularity: 72,
    })
    expect(result.invalid).toBe(3)
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
