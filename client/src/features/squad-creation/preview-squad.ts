import type { SessionDto } from '@squadzr/schemas'
import type { Game, PublicSquad } from '@/types'
import type { FormInput } from './create-squad-form'

/** Squad codes have six characters; the preview shows them masked, as the code is not known yet. */
export const MASKED_CODE = '••••••'

/** The preview is not stored anywhere, so its timestamps are a fixed placeholder. */
const PREVIEW_TIME = '1970-01-01T00:00:00.000Z'

interface PreviewSquadInput {
  game: Game
  values: Pick<FormInput, 'name' | 'tags' | 'language'> & { maxPlayers: number }
  /** The viewer, who is the Squad's only member. */
  viewer: SessionDto['user'] | undefined
  /** The name the card shows while the field is empty. */
  nameFallback: string
}

/** The Squad as others will see its card: the form's values, the viewer as the only member and a masked code. */
export function previewSquad({
  game,
  values,
  viewer,
  nameFallback,
}: PreviewSquadInput): PublicSquad {
  const { id, name, slug, genres, coverUrl, coverThumbUrl } = game

  return {
    id: 'preview',
    code: MASKED_CODE,
    name: values.name.trim() || nameFallback,
    hostId: viewer?.id ?? '',
    gameId: id,
    game: { id, name, slug, genres, coverUrl, coverThumbUrl },
    maxPlayers: values.maxPlayers,
    tags: values.tags ?? [],
    language: values.language ?? 'pt-br',
    memberCount: 1,
    memberPreview: viewer ? [{ id: viewer.id, name: viewer.name, image: viewer.image }] : [],
    createdAt: PREVIEW_TIME,
    updatedAt: PREVIEW_TIME,
  }
}
