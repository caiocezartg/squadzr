export interface AvatarColors {
  readonly background: string
  readonly foreground: string
}

const MINT_COLORS: AvatarColors = { background: '#0E4D3A', foreground: '#B9FFE4' }

/** The initials palette (docs/design/reference.md, Avatar palette). */
export const AVATAR_PALETTE: readonly AvatarColors[] = [
  MINT_COLORS,
  { background: '#3A2A5C', foreground: '#E7DBFF' },
  { background: '#5C3A1E', foreground: '#FFE2C7' },
  { background: '#1E3A5C', foreground: '#CFE6FF' },
  { background: '#5C1E3A', foreground: '#FFD1E6' },
  { background: '#4A4A1E', foreground: '#F4F4C2' },
  { background: '#1E4A4A', foreground: '#C6F4F4' },
]

/** FNV-1a, 32 bits: a fixed, dependency-free hash, so a player's colours never change between releases. */
function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** The colour pair of a player: the same id always gets the same pair. */
export function pickAvatarColors(playerId: string): AvatarColors {
  return AVATAR_PALETTE[hashString(playerId) % AVATAR_PALETTE.length] ?? MINT_COLORS
}
