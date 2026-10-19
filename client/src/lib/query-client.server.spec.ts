import { hydrate, QueryClient } from '@tanstack/query-core'
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

  it('hands a read the callback starts but does not return to the browser as a pending query', async () => {
    let finish!: (value: string) => void
    const read = new Promise<string>((resolve) => {
      finish = resolve
    })

    const state = await prefetchRoute((client) => {
      void client.prefetchQuery({ queryKey: ['rooms'], queryFn: () => read })
    })

    expect(state.queries).toHaveLength(1)
    expect(state.queries[0]?.state.status).toBe('pending')
    finish('late data')
    await expect(state.queries[0]?.promise).resolves.toBe('late data')
  })
})

// `prefetchRoute` leaves `dehydratedAt` out of a pending query. That relies on how `hydrate` treats a
// payload without it, which TanStack documents only for payloads from older versions. TanStack Query is
// pinned to one version in `client/package.json`; these specs fail when an upgrade changes the behavior.
describe('hydrating a pending query that prefetchRoute handed over', () => {
  async function pendingState(read: Promise<string>) {
    const state = await prefetchRoute((client) => {
      void client.prefetchQuery({ queryKey: ['rooms'], queryFn: () => read })
    })
    return state
  }

  it('carries the server read without the time the server took its state', async () => {
    const state = await pendingState(Promise.resolve('server data'))

    expect(state.queries[0]?.promise).toBeDefined()
    expect(state.queries[0]).not.toHaveProperty('dehydratedAt')
  })

  it('attaches the server read to a query the browser does not hold', async () => {
    const state = await pendingState(Promise.resolve('server data'))
    const browser = new QueryClient()
    const browserRead = vi.fn(async () => 'browser data')

    hydrate(browser, state)
    const result = await browser.fetchQuery({ queryKey: ['rooms'], queryFn: browserRead })

    // The browser waited on the server's promise instead of reading again.
    expect(result).toBe('server data')
    expect(browserRead).not.toHaveBeenCalled()
  })

  it('keeps the data a browser query already holds, even when the server read has settled', async () => {
    const state = await pendingState(Promise.resolve('server data'))
    const [dehydrated] = state.queries
    // React gives the browser a settled promise as a thenable that calls back at once.
    const settled = {
      then: (onFulfilled: (value: string) => unknown) => {
        onFulfilled('server data')
        return { catch: () => undefined }
      },
    } as unknown as Promise<string>
    const browser = new QueryClient()
    browser.setQueryData(['rooms'], 'cached data', { updatedAt: Date.now() - 120_000 })

    hydrate(browser, { ...state, queries: [{ ...dehydrated!, promise: settled }] })

    expect(browser.getQueryState(['rooms'])?.status).toBe('success')
    expect(browser.getQueryData(['rooms'])).toBe('cached data')
  })
})
