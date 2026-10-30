/**
 * Public interface of the squad joining capability. The Squad Board hands card
 * activations to `requestJoin` and renders `authPrompt` once; the Lobby of a Squad
 * the viewer is not in joins it with `useJoinSquad`, through the `join` entry. The join mutation and its contract
 * validation, the typed application errors, the sign-in callback with the intended squad
 * code, the lists it refreshes and the `?join=` auto-join stay internal.
 */
export { useSquadJoining, type JoinableSquad, type SquadJoining } from './use-squad-joining'
