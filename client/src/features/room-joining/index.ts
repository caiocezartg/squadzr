/**
 * Public interface of the room joining capability. The catalog hands card
 * activations to `requestJoin` and renders `authPrompt` once; the join
 * mutation and its contract validation, the typed application errors, the
 * sign-in callback with the intended room code, the catalog refresh and the
 * `?join=` auto-join stay internal.
 */
export { useRoomJoining, type JoinableRoom, type RoomJoining } from './use-room-joining'
