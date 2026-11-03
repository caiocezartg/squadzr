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

  it('redirects /rooms/:code to the Lobby permanently', async () => {
    const config = (await loadConfig('http://squadzr-api:3000')).default
    const redirects = (await config.redirects?.()) ?? []

    expect(redirects).toContainEqual({
      source: '/rooms/:code',
      destination: '/squads/:code',
      permanent: true,
    })
  })

  it('no longer redirects /rooms/my to a My Squads page, so both /rooms/my and /squads/my end in the Lobby route', async () => {
    const config = (await loadConfig('http://squadzr-api:3000')).default
    const redirects = (await config.redirects?.()) ?? []

    expect(redirects.map((redirect) => redirect.source)).not.toContain('/rooms/my')
    expect(redirects.map((redirect) => redirect.destination)).not.toContain('/squads/my')
    expect(redirects.map((redirect) => redirect.source)).toEqual(['/rooms', '/rooms/:code'])
  })

  it('keeps every page out of another site’s frame and sends the baseline security headers', async () => {
    const config = (await loadConfig('http://squadzr-api:3000')).default
    const rules = (await config.headers?.()) ?? []

    const everyPage = rules.find((rule) => rule.source === '/:path*')
    expect(everyPage?.headers).toEqual(
      expect.arrayContaining([
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
      ])
    )
  })

  it('lets scripts load only from the app, and no plugin, base or foreign form target', async () => {
    const config = (await loadConfig('http://squadzr-api:3000')).default
    const rules = (await config.headers?.()) ?? []

    const policy = rules
      .find((rule) => rule.source === '/:path*')
      ?.headers.find((header) => header.key === 'Content-Security-Policy')?.value
    expect(policy?.split('; ')).toEqual([
      "script-src 'self' 'unsafe-inline'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ])
  })

  it('also allows eval in development, where the dev server needs it', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const config = (await loadConfig('http://squadzr-api:3000')).default
    const rules = (await config.headers?.()) ?? []
    vi.unstubAllEnvs()

    const policy = rules
      .find((rule) => rule.source === '/:path*')
      ?.headers.find((header) => header.key === 'Content-Security-Policy')?.value
    expect(policy).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'")
  })
})
