import { z } from 'zod'
import { createRoomInputSchema } from '@squadzr/schemas'

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
