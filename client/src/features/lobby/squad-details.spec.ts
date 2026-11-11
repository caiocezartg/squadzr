import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '@/lib/api-contract'
import { lobbySquad, lobbySquadResponse } from '@/test/fixtures'
import type { SquadSource } from './squad-details'
import { discardFailedSquadRead, readSquadDetails, squadQueryKey } from './squad-details'

/** A source whose Squad read the test answers by hand. */
function fakeSource(overrides: Partial<SquadSource> = {}): SquadSource {
  return {
    readSquad: vi.fn(async () => lobbySquadResponse),
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('readSquadDetails', () => {
  it("returns the Squad's response, with the game summary it carries", async () => {
    const source = fakeSource()

    const response = await readSquadDetails(source, lobbySquad.code)

    expect(response).toEqual(lobbySquadResponse)
    expect(response?.room.game).toEqual(lobbySquad.game)
    expect(source.readSquad).toHaveBeenCalledWith(lobbySquad.code)
  })

  it('reads the code uppercased, as the contract carries it', async () => {
    const source = fakeSource()

    await readSquadDetails(source, 'lobby1')

    expect(source.readSquad).toHaveBeenCalledWith('LOBBY1')
  })

  it('reads a code the contract rejects as missing, without reading anything', async () => {
    const source = fakeSource()

    await expect(readSquadDetails(source, 'abc')).resolves.toBeNull()
    expect(source.readSquad).not.toHaveBeenCalled()
  })

  it('reads a Squad the viewer cannot see (a 404) as missing', async () => {
    const source = fakeSource({
      readSquad: vi.fn(async () => {
        throw new ApiClientError('Room not found', 404, 'ROOM_NOT_FOUND')
      }),
    })

    await expect(readSquadDetails(source, lobbySquad.code)).resolves.toBeNull()
  })

  it('throws any other failure of the Squad read', async () => {
    const failure = new ApiClientError('boom', 500, 'INTERNAL')
    const source = fakeSource({
      readSquad: vi.fn(async () => {
        throw failure
      }),
    })

    await expect(readSquadDetails(source, lobbySquad.code)).rejects.toBe(failure)
  })
})

describe('discardFailedSquadRead', () => {
  it('drops a failed read of the Squad that left no data', async () => {
    const queryClient = new QueryClient()
    await queryClient.prefetchQuery({
      queryKey: squadQueryKey(lobbySquad.code),
      queryFn: () => Promise.reject(new Error('boom')),
      retry: false,
    })
    expect(queryClient.getQueryState(squadQueryKey(lobbySquad.code))?.status).toBe('error')

    discardFailedSquadRead(queryClient, lobbySquad.code)

    expect(queryClient.getQueryState(squadQueryKey(lobbySquad.code))).toBeUndefined()
  })

  it('keeps a Squad that holds data, even when a later read failed', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(squadQueryKey(lobbySquad.code), lobbySquadResponse)

    discardFailedSquadRead(queryClient, lobbySquad.code)

    expect(queryClient.getQueryData(squadQueryKey(lobbySquad.code))).toEqual(lobbySquadResponse)
  })
})
