import type { RoomLanguage } from '@squadzr/schemas'

/** The words on the image, in the Squad's language. */
export interface ImageCopy {
  /** The small line over the game's name. */
  readonly kicker: string
  /** The line under the game's name: the open spots, or that every slot is taken. */
  readonly status: string
}

interface LanguageCopy {
  readonly open: { readonly kicker: string; readonly spots: (open: number) => string }
  readonly full: ImageCopy
}

const COPY: Record<RoomLanguage, LanguageCopy> = {
  'pt-br': {
    open: {
      kicker: 'Squad aberto',
      spots: (open) => `${open === 1 ? 'Falta' : 'Faltam'} ${open} — entra aí`,
    },
    full: { kicker: 'Squad completo', status: 'Todas as vagas preenchidas' },
  },
  en: {
    open: {
      kicker: 'Open squad',
      spots: (open) => `${open} ${open === 1 ? 'spot' : 'spots'} left — jump in`,
    },
    full: { kicker: 'Squad full', status: 'Every slot is taken' },
  },
}

/**
 * The kicker and the status line for a Squad with `filled` of `total` slots taken. A full Squad never
 * calls itself open.
 */
export function imageCopy(language: RoomLanguage, filled: number, total: number): ImageCopy {
  const copy = COPY[language]
  const open = total - filled
  if (open <= 0) return copy.full
  return { kicker: copy.open.kicker, status: copy.open.spots(open) }
}
