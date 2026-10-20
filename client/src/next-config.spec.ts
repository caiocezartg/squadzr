import { afterEach, describe, expect, it, vi } from 'vitest'

// Next loads `next.config.ts` when it starts, so importing it here runs the same startup check.
describe('next.config startup validation', () => {
  const savedValue = process.env.API_INTERNAL_URL

  function loadConfig(value: string | undefined) {
    if (value === undefined) delete process.env.API_INTERNAL_URL
    else process.env.API_INTERNAL_URL = value
    vi.resetModules()

    return import('../next.config')
  }

  afterEach(() => {
    if (savedValue === undefined) delete process.env.API_INTERNAL_URL
    else process.env.API_INTERNAL_URL = savedValue
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('stops the start when the internal API URL is not an HTTP(S) URL', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(loadConfig('squadzr-api:3000')).rejects.toThrow('Invalid environment variables')
  })

  it('lets the start continue with an HTTP(S) internal API URL', async () => {
    await expect(loadConfig('http://squadzr-api:3000')).resolves.toHaveProperty('default')
  })

  it('lets the start continue with the internal API URL unset', async () => {
    await expect(loadConfig(undefined)).resolves.toHaveProperty('default')
  })

  it('redirects /rooms/my to /squads/my permanently before the Lobby redirect', async () => {
    const config = (await loadConfig('http://squadzr-api:3000')).default
    const redirects = (await config.redirects?.()) ?? []

    expect(redirects[0]).toMatchObject({
      source: '/rooms/my',
      destination: '/squads/my',
      permanent: true,
    })

    const mySquadsIndex = redirects.findIndex((redirect) => redirect.source === '/rooms/my')
    const lobbyIndex = redirects.findIndex((redirect) => redirect.destination === '/squads/:code')
    expect(mySquadsIndex).toBeGreaterThanOrEqual(0)
    expect(lobbyIndex).toBeGreaterThan(mySquadsIndex)
  })

  it('keeps the Lobby redirect excluding My Squads', async () => {
    const config = (await loadConfig('http://squadzr-api:3000')).default
    const redirects = (await config.redirects?.()) ?? []

    expect(redirects).toContainEqual(
      expect.objectContaining({ source: '/rooms/:code((?![Mm][Yy]$)[^/]+)', permanent: true })
    )
  })
})
