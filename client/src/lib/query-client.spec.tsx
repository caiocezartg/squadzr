import { act, render, renderHook, waitFor } from '@testing-library/react'
import {
  HydrationBoundary,
  QueryClientProvider,
  dehydrate,
  type DehydratedState,
  type QueryClient,
} from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { createQueryClient, getQueryClient } from './query-client'

const ROOMS_KEY = ['rooms'] as const

function dehydratedRooms(value: string, updatedAt: number): DehydratedState {
  const source = createQueryClient()
  source.setQueryData(ROOMS_KEY, value, { updatedAt })
  return dehydrate(source)
}

function HydratedRooms({
  client,
  state,
}: {
  readonly client: QueryClient
  readonly state?: DehydratedState
}) {
  return (
    <QueryClientProvider client={client}>
      <HydrationBoundary state={state}>
        <span>rooms</span>
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
    const client = createQueryClient()
    client.setQueryData(ROOMS_KEY, 'stale', { updatedAt: 1_000 })
    const view = render(<HydratedRooms client={client} />)

    view.rerender(<HydratedRooms client={client} state={dehydratedRooms('fresh', 2_000)} />)

    await waitFor(() => expect(client.getQueryData(ROOMS_KEY)).toBe('fresh'))
  })

  it('keeps newer cached data over an older dehydrated result', async () => {
    const client = createQueryClient()
    client.setQueryData(ROOMS_KEY, 'current', { updatedAt: 2_000 })

    render(<HydratedRooms client={client} state={dehydratedRooms('older', 1_000)} />)
    await act(async () => {})

    expect(client.getQueryData(ROOMS_KEY)).toBe('current')
  })
})
