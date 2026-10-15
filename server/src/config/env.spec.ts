import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadEnv, parseEnv } from './env'

const REQUIRED_ENV = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/squadzr',
  BETTER_AUTH_SECRET: 'env-spec-secret-with-more-than-32-characters',
  DISCORD_CLIENT_ID: 'env-spec-client-id',
  DISCORD_CLIENT_SECRET: 'env-spec-client-secret',
}

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
