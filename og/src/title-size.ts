/**
 * The font size of the game's name: as large as the name allows, so a short name fills one line and a
 * long one still fits in two lines of the 600px column.
 */
export function titleSize(name: string): number {
  const length = name.trim().length
  if (length <= 11) return 112
  if (length <= 16) return 92
  if (length <= 26) return 76
  return 60
}
