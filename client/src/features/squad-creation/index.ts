/**
 * Public interface of the squad creation capability. Callers supply the games they already loaded
 * and mount the dialog while it is open; the shared form contract, the creation mutation, its typed
 * errors, the board refresh and the navigation to the new lobby stay internal.
 */
export { CreateSquadDialog } from './create-squad-dialog'
export type { CreateSquadModalProps } from './create-squad-modal'
