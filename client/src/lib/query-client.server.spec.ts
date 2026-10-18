import { describe, expect, it, vi } from 'vitest'
import { prefetchRoute } from './query-client'

// `isServer` is decided when the library loads. This suite loads it as a server does, so
// `getQueryClient` takes the per-request branch instead of the browser's singleton.
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  isServer: true,
}))

describe('prefetchRoute on the server', () => {
  it('gives each request its own query client, so no request reads another request data', async () => {
    const firstFetch = vi.fn(async () => 'first request')
    const first = await prefetchRoute((client) =>
      client.prefetchQuery({ queryKey: ['rooms'], queryFn: firstFetch })
    )

    const secondFetch = vi.fn(async () => 'second request')
    const second = await prefetchRoute((client) =>
      client.prefetchQuery({ queryKey: ['rooms'], queryFn: secondFetch })
    )

    // The second request fetched its own data instead of reading the first request's cache.
    expect(secondFetch).toHaveBeenCalledTimes(1)
    expect(first.queries[0]?.state.data).toBe('first request')
    expect(second.queries[0]?.state.data).toBe('second request')
  })

  it('leaves out a query that failed, so the browser fetches it again', async () => {
    const state = await prefetchRoute((client) =>
      client.prefetchQuery({
        queryKey: ['games'],
        queryFn: async () => {
          throw new Error('games unavailable')
        },
        retry: false,
      })
    )

    expect(state.queries).toEqual([])
  })
})
