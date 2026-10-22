import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '@/lib/api-contract'
import { gameLol, lobbySquadResponse, lobbySquad } from '@/test/fixtures'
import type { DetailsSource } from './squad-details'
import { discardFailedSquadRead, readSquadDetails, squadQueryKey } from './squad-details'

/** A source whose reads the test answers by hand. */
function fakeSource(overrides: Partial<DetailsSource> = {}): DetailsSource {
  return {
    readSquad: vi.fn(async () => lobbySquadResponse),
    readGame: vi.fn(async () => gameLol),
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('readSquadDetails', () => {
  it("returns the Squad's response with its game", async () => {
    const source = fakeSource()

    await expect(readSquadDetails(source, lobbySquad.code)).resolves.toEqual({
      response: lobbySquadResponse,
      game: gameLol,
    })
    expect(source.readSquad).toHaveBeenCalledWith(lobbySquad.code)
    expect(source.readGame).toHaveBeenCalledWith(lobbySquad.gameId)
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
    expect(source.readGame).not.toHaveBeenCalled()
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

  it('leaves the game out when the game read fails, and logs the failure', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const source = fakeSource({
      readGame: vi.fn(async () => {
        throw new ApiClientError('Game not found', 404, 'GAME_NOT_FOUND')
      }),
    })

    await expect(readSquadDetails(source, lobbySquad.code)).resolves.toEqual({
      response: lobbySquadResponse,
      game: null,
    })
    expect(consoleError).toHaveBeenCalled()
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
    queryClient.setQueryData(squadQueryKey(lobbySquad.code), {
      response: lobbySquadResponse,
      game: gameLol,
    })

    discardFailedSquadRead(queryClient, lobbySquad.code)

    expect(queryClient.getQueryData(squadQueryKey(lobbySquad.code))).toEqual({
      response: lobbySquadResponse,
      game: gameLol,
    })
  })
})
