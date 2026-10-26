/**
 * The address of a Squad's Lobby. Every link to a Lobby is built here, so the path lives in one place.
 */
export function lobbyHref(squadCode: string): string {
  return `/squads/${encodeURIComponent(squadCode)}`
}

/** A Squad code as the contract writes it: six letters or digits, in either case. */
export const SQUAD_CODE_PATTERN = /^[A-Za-z0-9]{6}$/

/**
 * The code a viewer typed or pasted, as the contract writes it, or `null` when it is not a Squad code.
 * A leading `#` is dropped, because codes are shown as `#VLR77`. Nothing but a valid code ever reaches
 * a URL or a request.
 */
export function parseSquadCode(input: string): string | null {
  const code = input.trim().replace(/^#/, '')
  return SQUAD_CODE_PATTERN.test(code) ? code.toUpperCase() : null
}

/** The Squad Board's invite link for a code: signed-in viewers join it, visitors are asked to sign in. */
export function joinHref(squadCode: string): string {
  return `/squads?join=${encodeURIComponent(squadCode)}`
}
