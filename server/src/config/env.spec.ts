import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadEnv, parseEnv } from './env'

const REQUIRED_ENV = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/squadzr',
  BETTER_AUTH_SECRET: 'env-spec-secret-with-more-than-32-characters',
  DISCORD_CLIENT_ID: 'env-spec-client-id',
  DISCORD_CLIENT_SECRET: 'env-spec-client-secret',
}

describe('TRUST_PROXY_HOPS', () => {
  it('trusts one edge proxy by default', () => {
    expect(parseEnv(REQUIRED_ENV).TRUST_PROXY_HOPS).toBe(1)
  })

  it('reads a hop count, zero included', () => {
    expect(parseEnv({ ...REQUIRED_ENV, TRUST_PROXY_HOPS: '2' }).TRUST_PROXY_HOPS).toBe(2)
    expect(parseEnv({ ...REQUIRED_ENV, TRUST_PROXY_HOPS: '0' }).TRUST_PROXY_HOPS).toBe(0)
  })

  it.each(['-1', '1.5', 'true', ''])('refuses %j', (value) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => parseEnv({ ...REQUIRED_ENV, TRUST_PROXY_HOPS: value })).toThrow()
  })
})

describe('EDGE_AUTH_TOKEN', () => {
  const TOKEN = 'edge-secret-0123456789abcdef-0123456789'

  it('is unset by default: the origin lock is off', () => {
    expect(parseEnv(REQUIRED_ENV).EDGE_AUTH_TOKEN).toBeUndefined()
  })

  it('reads an empty value as unset', () => {
    expect(parseEnv({ ...REQUIRED_ENV, EDGE_AUTH_TOKEN: '' }).EDGE_AUTH_TOKEN).toBeUndefined()
  })

  it('reads a token as it is', () => {
    expect(parseEnv({ ...REQUIRED_ENV, EDGE_AUTH_TOKEN: TOKEN }).EDGE_AUTH_TOKEN).toBe(TOKEN)
  })

  it.each([
    ['shorter than 32 characters', 'short-secret'],
    ['holding a space', `${TOKEN} x`],
    ['holding a newline', `${TOKEN}\n`],
    ['holding a non-ASCII character', `${TOKEN}é`],
  ])('refuses a token %s', (_label, value) => {
    expect(() => parseEnv({ ...REQUIRED_ENV, EDGE_AUTH_TOKEN: value })).toThrow()
  })

  it('does not repeat a refused token in the error', () => {
    const refused = `${TOKEN} refused`

    expect(() => parseEnv({ ...REQUIRED_ENV, EDGE_AUTH_TOKEN: refused })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(refused) })
    )
  })
})

describe('abuse limits', () => {
  it('default to 300 requests a minute, 20 upgrades a minute and 10 sockets per address', () => {
    const env = parseEnv(REQUIRED_ENV)

    expect(env).toMatchObject({
      RATE_LIMIT_MAX: 300,
      RATE_LIMIT_WINDOW_MS: 60_000,
      WS_UPGRADES_PER_MINUTE: 20,
      WS_MAX_CONNECTIONS_PER_IP: 10,
    })
  })

  it('read whole numbers, and 0 as no limit', () => {
    const env = parseEnv({
      ...REQUIRED_ENV,
      RATE_LIMIT_MAX: '0',
      RATE_LIMIT_WINDOW_MS: '10000',
      WS_UPGRADES_PER_MINUTE: '5',
      WS_MAX_CONNECTIONS_PER_IP: '0',
    })

    expect(env).toMatchObject({
      RATE_LIMIT_MAX: 0,
      RATE_LIMIT_WINDOW_MS: 10_000,
      WS_UPGRADES_PER_MINUTE: 5,
      WS_MAX_CONNECTIONS_PER_IP: 0,
    })
  })

  it.each([
    ['RATE_LIMIT_MAX', '-1'],
    ['RATE_LIMIT_MAX', '1.5'],
    ['RATE_LIMIT_MAX', 'many'],
    ['RATE_LIMIT_WINDOW_MS', '0'],
    ['WS_UPGRADES_PER_MINUTE', 'x'],
    ['WS_MAX_CONNECTIONS_PER_IP', '-3'],
  ])('refuse %s=%s', (name, value) => {
    expect(() => parseEnv({ ...REQUIRED_ENV, [name]: value })).toThrow()
  })
})

describe('BETTER_AUTH_COOKIE_DOMAIN', () => {
  it('is unset by default', () => {
    expect(parseEnv(REQUIRED_ENV).BETTER_AUTH_COOKIE_DOMAIN).toBeUndefined()
  })

  it('accepts a parent domain', () => {
    const env = parseEnv({ ...REQUIRED_ENV, BETTER_AUTH_COOKIE_DOMAIN: 'squadzr.app' })

    expect(env.BETTER_AUTH_COOKIE_DOMAIN).toBe('squadzr.app')
  })

  it.each([
    ['a URL', 'https://squadzr.app'],
    ['a leading dot', '.squadzr.app'],
    ['a single label', 'localhost'],
    ['an IP address', '127.0.0.1'],
    ['a port', 'squadzr.app:443'],
    ['a wildcard', '*.squadzr.app'],
    ['an empty value', ''],
  ])('rejects %s', (_label, value) => {
    expect(() => parseEnv({ ...REQUIRED_ENV, BETTER_AUTH_COOKIE_DOMAIN: value })).toThrow(
      'BETTER_AUTH_COOKIE_DOMAIN must be a parent domain such as squadzr.app'
    )
  })
})

describe('loadEnv', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stops server startup when BETTER_AUTH_COOKIE_DOMAIN is invalid', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(() =>
      loadEnv({ ...REQUIRED_ENV, BETTER_AUTH_COOKIE_DOMAIN: 'https://squadzr.app' })
    ).toThrow('process.exit')
    expect(exit).toHaveBeenCalledWith(1)
  })
})

describe('IGDB settings of the manual Catalog Import', () => {
  it('boots without them, with the cron thresholds as defaults', () => {
    const env = parseEnv(REQUIRED_ENV)

    expect(env.IGDB_CLIENT_ID).toBeUndefined()
    expect(env.IGDB_CLIENT_SECRET).toBeUndefined()
    expect(env.IGDB_POPULARITY_THRESHOLD).toBe(50)
    expect(env.IGDB_HYPE_THRESHOLD).toBe(50)
  })

  it('reads the credentials and the thresholds', () => {
    const env = parseEnv({
      ...REQUIRED_ENV,
      IGDB_CLIENT_ID: 'twitch-id',
      IGDB_CLIENT_SECRET: 'twitch-secret',
      IGDB_POPULARITY_THRESHOLD: '80',
      IGDB_HYPE_THRESHOLD: '0',
    })

    expect(env).toMatchObject({
      IGDB_CLIENT_ID: 'twitch-id',
      IGDB_CLIENT_SECRET: 'twitch-secret',
      IGDB_POPULARITY_THRESHOLD: 80,
      IGDB_HYPE_THRESHOLD: 0,
    })
  })

  it('treats empty credentials like unset ones and empty thresholds like the defaults', () => {
    const env = parseEnv({
      ...REQUIRED_ENV,
      IGDB_CLIENT_ID: '',
      IGDB_CLIENT_SECRET: '',
      IGDB_POPULARITY_THRESHOLD: '',
      IGDB_HYPE_THRESHOLD: '',
    })

    expect(env.IGDB_CLIENT_ID).toBeUndefined()
    expect(env.IGDB_POPULARITY_THRESHOLD).toBe(50)
    expect(env.IGDB_HYPE_THRESHOLD).toBe(50)
  })

  it.each(['-1', '1.5', 'many'])('refuses the threshold %j like the cron does', (value) => {
    expect(() => parseEnv({ ...REQUIRED_ENV, IGDB_POPULARITY_THRESHOLD: value })).toThrow()
    expect(() => parseEnv({ ...REQUIRED_ENV, IGDB_HYPE_THRESHOLD: value })).toThrow()
  })
})
