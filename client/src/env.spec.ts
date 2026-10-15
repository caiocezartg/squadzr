import { afterEach, describe, expect, it, vi } from 'vitest'
import { parsePublicEnv } from './env'

describe('parsePublicEnv', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to the local API when NEXT_PUBLIC_API_URL is unset', () => {
    expect(parsePublicEnv({})).toEqual({ NEXT_PUBLIC_API_URL: 'http://localhost:3000' })
  })

  it('keeps an absolute API URL', () => {
    expect(parsePublicEnv({ NEXT_PUBLIC_API_URL: 'https://api.squadzr.app' })).toEqual({
      NEXT_PUBLIC_API_URL: 'https://api.squadzr.app',
    })
  })

  it('rejects a value that is not an absolute URL', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => parsePublicEnv({ NEXT_PUBLIC_API_URL: 'api.squadzr.app' })).toThrow(
      'Invalid environment variables'
    )
  })
})
