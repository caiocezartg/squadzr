import { afterEach, describe, expect, it, vi } from 'vitest'

const savedValue = process.env.NEXT_PUBLIC_API_URL

/** Imports the env module with `NEXT_PUBLIC_API_URL` set as the build would see it. */
function loadEnv(value: string | undefined) {
  if (value === undefined) delete process.env.NEXT_PUBLIC_API_URL
  else process.env.NEXT_PUBLIC_API_URL = value
  vi.resetModules()

  return import('./env')
}

afterEach(() => {
  if (savedValue === undefined) delete process.env.NEXT_PUBLIC_API_URL
  else process.env.NEXT_PUBLIC_API_URL = savedValue
  vi.resetModules()
  vi.restoreAllMocks()
})

describe('public env', () => {
  it('falls back to the local API when NEXT_PUBLIC_API_URL is unset', async () => {
    const { env } = await loadEnv(undefined)

    expect(env).toEqual({ NEXT_PUBLIC_API_URL: 'http://localhost:3000' })
  })

  it('keeps an absolute API URL', async () => {
    const { env } = await loadEnv('https://api.squadzr.app')

    expect(env).toEqual({ NEXT_PUBLIC_API_URL: 'https://api.squadzr.app' })
  })

  it('rejects a value that is not an absolute URL', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(loadEnv('api.squadzr.app')).rejects.toThrow('Invalid environment variables')
  })
})
