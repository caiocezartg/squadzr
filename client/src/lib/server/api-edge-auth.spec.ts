import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { EDGE_AUTH_HEADER } from '@squadzr/schemas'

const schema = z.object({ ok: z.boolean() })
const EDGE_TOKEN = 'edge-secret-0123456789-abcdefghijklmnop'

// The token is read once, when `@/env.server` loads, so each case loads the client fresh.
async function sentHeaders(token: string | undefined, path: string): Promise<Headers> {
  if (token === undefined) delete process.env.EDGE_AUTH_TOKEN
  else process.env.EDGE_AUTH_TOKEN = token
  vi.resetModules()
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{"ok":true}')
  )
  vi.stubGlobal('fetch', fetchMock)

  const { serverApi } = await import('./api')
  await serverApi.get(path, schema, { credentials: 'anonymous', caching: 'uncached' })

  return new Headers(fetchMock.mock.calls[0]?.[1]?.headers)
}

describe('serverApi.get edge secret', () => {
  const savedToken = process.env.EDGE_AUTH_TOKEN

  afterEach(() => {
    if (savedToken === undefined) delete process.env.EDGE_AUTH_TOKEN
    else process.env.EDGE_AUTH_TOKEN = savedToken
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('sends the secret in the edge header the API checks', async () => {
    expect((await sentHeaders(EDGE_TOKEN, '/api/public')).get(EDGE_AUTH_HEADER)).toBe(EDGE_TOKEN)
  })

  it('sends it on a call that revalidates and on a viewer call alike', async () => {
    const token = EDGE_TOKEN
    process.env.EDGE_AUTH_TOKEN = token
    vi.resetModules()
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{"ok":true}')
    )
    vi.stubGlobal('fetch', fetchMock)
    const { serverApi } = await import('./api')

    await serverApi.get('/api/a', schema, { credentials: 'anonymous', caching: 'revalidated' })
    await serverApi.get('/api/b', schema, {
      credentials: 'viewer',
      caching: 'uncached',
      cookie: 'a=b',
    })

    for (const [, init] of fetchMock.mock.calls) {
      expect(new Headers(init?.headers).get(EDGE_AUTH_HEADER)).toBe(token)
    }
  })

  it('sends no edge header while the API has no lock', async () => {
    expect((await sentHeaders(undefined, '/api/public')).has(EDGE_AUTH_HEADER)).toBe(false)
  })
})
