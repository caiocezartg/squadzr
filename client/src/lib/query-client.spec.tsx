import { act, render, renderHook, waitFor } from '@testing-library/react'
import {
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
  dehydrate,
  type DehydratedState,
} from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { ApiClientError } from './api-contract'
import { getQueryClient } from './query-client'

const SQUADS_KEY = ['squads'] as const

describe('query retry policy', () => {
  const retry = getQueryClient().getDefaultOptions().queries?.retry as (
    failureCount: number,
    error: unknown
  ) => boolean

  it('does not retry a 4xx API error', () => {
    expect(retry(0, new ApiClientError('Not found', 404))).toBe(false)
  })

  it('retries a 5xx API error up to three times', () => {
    expect(retry(0, new ApiClientError('Unavailable', 503))).toBe(true)
    expect(retry(2, new ApiClientError('Unavailable', 503))).toBe(true)
    expect(retry(3, new ApiClientError('Unavailable', 503))).toBe(false)
  })

  it('retries a failure that is not an API error', () => {
    expect(retry(0, new Error('network'))).toBe(true)
  })
})

function dehydratedSquads(value: string, updatedAt: number): DehydratedState {
  const source = new QueryClient()
  source.setQueryData(SQUADS_KEY, value, { updatedAt })
  return dehydrate(source)
}

function HydratedSquads({
  client,
  state,
}: {
  readonly client: QueryClient
  readonly state?: DehydratedState
}) {
  return (
    <QueryClientProvider client={client}>
      <HydrationBoundary state={state}>
        <span>squads</span>
      </HydrationBoundary>
    </QueryClientProvider>
  )
}

describe('getQueryClient in the browser', () => {
  it('keeps one query client across rerenders', () => {
    const { result, rerender } = renderHook(() => getQueryClient())
    const first = result.current

    rerender()

    expect(result.current).toBe(first)
    expect(getQueryClient()).toBe(first)
  })
})

describe('hydrating a dehydrated route', () => {
  it('replaces older cached data with a fresher dehydrated result', async () => {
    const client = new QueryClient()
    client.setQueryData(SQUADS_KEY, 'stale', { updatedAt: 1_000 })
    const view = render(<HydratedSquads client={client} />)

    view.rerender(<HydratedSquads client={client} state={dehydratedSquads('fresh', 2_000)} />)

    await waitFor(() => expect(client.getQueryData(SQUADS_KEY)).toBe('fresh'))
  })

  it('keeps newer cached data over an older dehydrated result', async () => {
    const client = new QueryClient()
    client.setQueryData(SQUADS_KEY, 'current', { updatedAt: 2_000 })

    render(<HydratedSquads client={client} state={dehydratedSquads('older', 1_000)} />)
    await act(async () => {})

    expect(client.getQueryData(SQUADS_KEY)).toBe('current')
  })
})
