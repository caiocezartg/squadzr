import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseServerEnv } from './env.server'
import { env } from './env'

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
