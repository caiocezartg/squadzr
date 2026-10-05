/**
 * Public interface of the room creation capability. Callers supply the games
 * they already loaded and control the dialog; the shared form contract, the
 * creation mutation, its typed errors, the catalog refresh and the navigation
 * to the new lobby stay internal.
 */
export { CreateRoomModal, type CreateRoomModalProps } from './create-room-modal'
