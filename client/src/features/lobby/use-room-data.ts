import { useQuery } from '@tanstack/react-query'
import { gameResponseSchema, isRoomLobbyResponse, roomResponseSchema } from '@squadzr/schemas'
import type { RoomLobbyResponse } from '@squadzr/schemas'
import { api } from '@/lib/api'
import type { Game, RoomResponse } from '@/types'

export interface RoomData {
  /** Static room metadata; the live snapshot supersedes it while connected. */
  room: RoomResponse['room'] | null
  /** Member-only HTTP details (the authorized Discord invite); null otherwise. */
  lobby: RoomLobbyResponse | null
  game: Game | null
  isLoading: boolean
  hasError: boolean
}

/**
 * The lobby's HTTP data: room metadata and the game cover. The room response
 * is the member lobby projection for members and the public projection for
 * everyone else, so it never carries the Discord invite to non-members.
 */
export function useRoomData(roomCode: string): RoomData {
  const {
    data: roomData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['room', roomCode],
    queryFn: () => api.get(`/api/rooms/${roomCode}`, roomResponseSchema),
  })

  const gameId = roomData?.room.gameId
  const { data: gameData } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => api.get(`/api/games/${gameId}`, gameResponseSchema),
    enabled: !!gameId,
    staleTime: 60_000,
  })

  return {
    room: roomData?.room ?? null,
    lobby: roomData && isRoomLobbyResponse(roomData) ? roomData : null,
    game: gameData?.game ?? null,
    isLoading,
    hasError: !!error,
  }
}
