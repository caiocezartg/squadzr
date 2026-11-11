import { roomsResponseSchema } from '@squadzr/schemas'
import { api } from '@/lib/api'

/** The browser's read of the Squad Board list, shared by every reader of the board's cache entry. */
export function readSquadBoard() {
  return api.get('/api/rooms', roomsResponseSchema)
}
