import { myRoomsResponseSchema, type MyRoomsResponse } from '@squadzr/schemas'
import { api } from '@/lib/api'
import { isUnauthorized } from '@/lib/api-contract'

/** The browser's read of the lists. A 401 reads as `null` (signed out), as the server's read does. */
export async function readMySquads(): Promise<MyRoomsResponse | null> {
  try {
    return await api.get('/api/rooms/my', myRoomsResponseSchema)
  } catch (error) {
    if (isUnauthorized(error)) return null
    throw error
  }
}
