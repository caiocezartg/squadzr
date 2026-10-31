import { z } from 'zod'
import { createRoomInputSchema } from '@squadzr/schemas'
import type { Game } from '@/types'

export const formSchema = createRoomInputSchema.extend({
  gameId: z.uuid(),
})

export type FormInput = z.input<typeof formSchema>
export type FormValues = z.output<typeof formSchema>

/** The wizard's steps, in order. */
export const STEPS = ['game', 'details', 'discord'] as const
export type Step = (typeof STEPS)[number]

/** The fields step 2 owns; "Continue" validates exactly these. */
export const DETAIL_FIELDS = ['name', 'maxPlayers', 'tags', 'language'] as const

/** The longest a Squad name may be, as the contract states it. */
export const NAME_MAX_LENGTH = formSchema.shape.name.maxLength ?? 30

const playersSchema = formSchema.shape.maxPlayers.unwrap()

/** The fewest and the most players a Squad may have, read from the contract. */
export const PLAYER_LIMITS = { min: playersSchema.minValue ?? 2, max: playersSchema.maxValue ?? 40 }

/** The player count a new Squad of the game starts from: the game's maximum, within the limits. */
export function defaultPlayers(game: Game): number {
  return Math.min(Math.max(game.maxPlayers, PLAYER_LIMITS.min), PLAYER_LIMITS.max)
}
