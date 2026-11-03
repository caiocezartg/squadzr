/**
 * Public interface of the squad creation capability. Callers mount the dialog while it is open and it
 * searches the game catalog itself; the shared form contract, the creation mutation, its typed
 * errors, the board refresh and the navigation to the new lobby stay internal.
 */
export { CreateSquadDialog } from './create-squad-dialog'
export type { CreateSquadDialogProps } from './create-squad-dialog'
