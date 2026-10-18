import type { z } from 'zod'
import type { roomLanguageSchema } from '@squadzr/schemas'

type RoomLanguage = z.infer<typeof roomLanguageSchema>

/** The message of a room language's badge. The card, the Lobby and the create form share these labels. */
export function languageBadgeKey(language: RoomLanguage): 'languages.ptBr' | 'languages.enUs' {
  return language === 'pt-br' ? 'languages.ptBr' : 'languages.enUs'
}
