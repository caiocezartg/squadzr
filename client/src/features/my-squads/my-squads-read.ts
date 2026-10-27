import { myRoomsResponseSchema, type MyRoomsResponse } from '@squadzr/schemas'
import { api, ApiClientError, ApiContractError } from '@/lib/api'

/** A 401, whatever body it carried, is the API saying the viewer has no session. */
function isUnauthorized(error: unknown): boolean {
  return (
    (error instanceof ApiClientError || error instanceof ApiContractError) && error.status === 401
  )
}

/** The browser's read of the lists. A 401 reads as `null` (signed out), as the server's read does. */
export async function readMySquads(): Promise<MyRoomsResponse | null> {
  try {
    return await api.get('/api/rooms/my', myRoomsResponseSchema)
  } catch (error) {
    if (isUnauthorized(error)) return null
    throw error
  }
}
