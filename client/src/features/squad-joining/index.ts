/**
 * Public interface of the squad joining capability. The Squad Board hands card
 * activations to `requestJoin` and renders `authPrompt` once; the join
 * mutation and its contract validation, the typed application errors, the
 * sign-in callback with the intended squad code, the board refresh and the
 * `?join=` auto-join stay internal.
 */
export { useSquadJoining, type JoinableSquad, type SquadJoining } from './use-squad-joining'
