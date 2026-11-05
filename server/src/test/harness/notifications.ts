/**
 * The payload of a `room_ready` notification, or a thrown error when the notification is
 * missing or of another type. Works for the HTTP contract and for the domain entity.
 */
export function roomReadyPayload<T extends { readonly type: string; readonly payload: unknown }>(
  notification: T | undefined
): Extract<T, { type: 'room_ready' }>['payload'] {
  if (notification?.type !== 'room_ready') {
    throw new Error(`Expected a room_ready notification, got ${notification?.type ?? 'none'}`)
  }
  return notification.payload as Extract<T, { type: 'room_ready' }>['payload']
}
