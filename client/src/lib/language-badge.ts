import type { z } from 'zod'
import type { roomLanguageSchema } from '@squadzr/schemas'

type SquadLanguage = z.infer<typeof roomLanguageSchema>

/** The message of a squad language's badge. The card, the Lobby and the create form share these labels. */
export function languageBadgeKey(language: SquadLanguage): 'languages.ptBr' | 'languages.enUs' {
  return language === 'pt-br' ? 'languages.ptBr' : 'languages.enUs'
}
