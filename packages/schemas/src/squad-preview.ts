import { z } from 'zod'
import { roomLanguageSchema, type RoomLanguage } from './room'

/**
 * The link preview image of a Squad invite (GitHub #152). One image stands for every Squad in the same
 * state: its game, how many slots are filled out of how many, and its language. It never carries a
 * Squad's name, members or avatars, so the image a key names never changes and is cached as immutable.
 * The Squad page points at the next key when its member count changes.
 *
 * The key travels in the image's path, `/og/squad/<game id>/<filled>-<total>/<language>.jpg`, served by
 * the `squadzr-og` Worker on `squadzr.app/og/*`. Every key has exactly one spelling (a lowercase id and
 * numbers without leading zeros), so two URLs never render the same picture twice.
 */
export const SQUAD_PREVIEW_PATH_PREFIX = '/og/squad/'

export const SQUAD_PREVIEW_IMAGE_SIZE = { width: 1200, height: 630 } as const

/** The image is a JPEG: a cover photo and its blurred copy keep a PNG well above the 300 KB WhatsApp shows. */
export const SQUAD_PREVIEW_IMAGE_TYPE = 'image/jpeg'

/** The most slots a key may name: the largest Squad the API creates. */
export const SQUAD_PREVIEW_MAX_SLOTS = 40

// A slot count as the path spells it: 1 to 99 with no leading zero, read as a number.
const slotCountSchema = z
  .string()
  .regex(/^[1-9]\d?$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(SQUAD_PREVIEW_MAX_SLOTS))

// The game id as the API spells it: a lowercase UUID.
const gameIdSchema = z.uuid().regex(/^[0-9a-f-]+$/)

const PATH_PATTERN = /^\/og\/squad\/([^/]+)\/([^/-]+)-([^/]+)\/([^/]+)\.jpg$/

/** A preview image key read from a path: the shape alone, before the game's own limits are checked. */
export const squadPreviewKeySchema = z
  .object({
    gameId: gameIdSchema,
    filled: slotCountSchema,
    total: slotCountSchema,
    language: roomLanguageSchema,
  })
  .refine((key) => key.filled <= key.total, { message: 'filled must not exceed total' })

export interface SquadPreviewKey {
  readonly gameId: string
  readonly filled: number
  readonly total: number
  readonly language: RoomLanguage
}

/** The image path of a key. */
export function squadPreviewImagePath(key: SquadPreviewKey): string {
  return `${SQUAD_PREVIEW_PATH_PREFIX}${key.gameId}/${key.filled}-${key.total}/${key.language}.jpg`
}

/** The key a path names, or `null` when the path is not exactly one key's spelling. */
export function parseSquadPreviewPath(pathname: string): SquadPreviewKey | null {
  const match = PATH_PATTERN.exec(pathname)
  if (!match) return null

  const [, gameId, filled, total, language] = match
  const parsed = squadPreviewKeySchema.safeParse({ gameId, filled, total, language })
  return parsed.success ? parsed.data : null
}
