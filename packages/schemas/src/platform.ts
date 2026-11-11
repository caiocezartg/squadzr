import { z } from 'zod'

// The platforms a Squad can be played on, in display order. The order is the one
// every list shows (creation, filter, import) and is part of the contract.
export const PLATFORMS = [
  'pc',
  'ps5',
  'ps4',
  'xbox-series',
  'xbox-one',
  'switch-2',
  'switch',
  'mobile',
] as const

export const platformSchema = z.enum(PLATFORMS)

export type Platform = z.infer<typeof platformSchema>

// Display labels. They are brand names, so they read the same in every language.
export const PLATFORM_LABELS: Readonly<Record<Platform, string>> = {
  pc: 'PC',
  ps5: 'PS5',
  ps4: 'PS4',
  'xbox-series': 'Xbox Series',
  'xbox-one': 'Xbox One',
  'switch-2': 'Switch 2',
  switch: 'Switch',
  mobile: 'Mobile',
}

// IGDB platform ids behind each Platform. Ids that are not listed here (PS3,
// Xbox 360, Wii U, ...) are ignored by the Catalog Import.
export const IGDB_PLATFORM_IDS: Readonly<Record<Platform, readonly number[]>> = {
  pc: [6, 14, 3], // Windows, Mac, Linux
  ps5: [167],
  ps4: [48],
  'xbox-series': [169],
  'xbox-one': [49],
  'switch-2': [508],
  switch: [130],
  mobile: [34, 39], // Android, iOS
}

// Maps IGDB platform ids to Platforms: deduplicated, in display order, unknown
// ids dropped.
export function platformsFromIgdbIds(igdbIds: readonly number[]): Platform[] {
  const ids = new Set(igdbIds)
  return PLATFORMS.filter((platform) => IGDB_PLATFORM_IDS[platform].some((id) => ids.has(id)))
}
