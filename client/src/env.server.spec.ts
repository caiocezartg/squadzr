import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseServerEnv } from './env.server'
import { env } from './env'

const EDGE_TOKEN = 'edge-secret-0123456789-abcdefghijklmnop'

describe('parseServerEnv', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('accepts an unset internal API URL', () => {
    expect(parseServerEnv({})).toEqual({})
  })

  it('keeps an absolute internal API URL', () => {
    expect(parseServerEnv({ API_INTERNAL_URL: 'http://squadzr-api:3000' })).toEqual({
      API_INTERNAL_URL: 'http://squadzr-api:3000',
    })
  })

  it('rejects an internal API value that is not an HTTP(S) URL', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => parseServerEnv({ API_INTERNAL_URL: 'squadzr-api:3000' })).toThrow(
      'Invalid environment variables'
    )
  })
})

describe('parseServerEnv edge secret', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps a valid edge secret', () => {
    expect(parseServerEnv({ EDGE_AUTH_TOKEN: EDGE_TOKEN })).toEqual({ EDGE_AUTH_TOKEN: EDGE_TOKEN })
  })

  it('treats an unset or empty edge secret as no lock', () => {
    expect(parseServerEnv({}).EDGE_AUTH_TOKEN).toBeUndefined()
    expect(parseServerEnv({ EDGE_AUTH_TOKEN: '' }).EDGE_AUTH_TOKEN).toBeUndefined()
  })

  it.each([
    ['shorter than 32 characters', 'a'.repeat(31)],
    ['holding a space', `${'a'.repeat(31)} b`],
    ['holding a non-ASCII character', `${'a'.repeat(31)}é`],
  ])('rejects an edge secret %s without printing it', (_label, value) => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => parseServerEnv({ EDGE_AUTH_TOKEN: value })).toThrow(
      'Invalid environment variables'
    )
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(value)
  })
})

describe('EDGE_AUTH_TOKEN', () => {
  const savedValue = process.env.EDGE_AUTH_TOKEN

  async function loadToken(value: string | undefined): Promise<string | undefined> {
    if (value === undefined) delete process.env.EDGE_AUTH_TOKEN
    else process.env.EDGE_AUTH_TOKEN = value
    vi.resetModules()

    return (await import('./env.server')).EDGE_AUTH_TOKEN
  }

  afterEach(() => {
    if (savedValue === undefined) delete process.env.EDGE_AUTH_TOKEN
    else process.env.EDGE_AUTH_TOKEN = savedValue
    vi.resetModules()
  })

  it('is undefined while the API has no lock', async () => {
    expect(await loadToken(undefined)).toBeUndefined()
  })

  it('reads the Worker secret from the process environment', async () => {
    expect(await loadToken(EDGE_TOKEN)).toBe(EDGE_TOKEN)
  })
})

describe('API_INTERNAL_URL', () => {
  const savedValue = process.env.API_INTERNAL_URL

  // The module validates process.env once, when it loads, so each case loads it fresh.
  async function loadInternalUrl(value: string | undefined): Promise<string> {
    if (value === undefined) delete process.env.API_INTERNAL_URL
    else process.env.API_INTERNAL_URL = value
    vi.resetModules()

    return (await import('./env.server')).API_INTERNAL_URL
  }

  afterEach(() => {
    if (savedValue === undefined) delete process.env.API_INTERNAL_URL
    else process.env.API_INTERNAL_URL = savedValue
    vi.resetModules()
  })

  it('falls back to the public API URL when the internal one is unset', async () => {
    expect(await loadInternalUrl(undefined)).toBe(env.NEXT_PUBLIC_API_URL)
  })

  it('uses the internal API URL when it is set', async () => {
    expect(await loadInternalUrl('http://squadzr-api:3000')).toBe('http://squadzr-api:3000')
  })
})
