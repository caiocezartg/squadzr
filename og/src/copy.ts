import type { RoomLanguage } from '@squadzr/schemas'

/** The words on the image, in the Squad's language. */
export interface ImageCopy {
  readonly kicker: string
  readonly openSpots: string
}

const COPY: Record<RoomLanguage, { kicker: string; spots: (open: number) => string }> = {
  'pt-br': {
    kicker: 'Squad aberto',
    spots: (open) =>
      open === 0 ? 'Squad completo' : `${open === 1 ? 'Falta' : 'Faltam'} ${open} — entra aí`,
  },
  en: {
    kicker: 'Open squad',
    spots: (open) =>
      open === 0 ? 'Squad full' : `${open} ${open === 1 ? 'spot' : 'spots'} left — jump in`,
  },
}

/** The kicker and the open-spots line for a Squad with `filled` of `total` slots taken. */
export function imageCopy(language: RoomLanguage, filled: number, total: number): ImageCopy {
  const copy = COPY[language]
  return { kicker: copy.kicker, openSpots: copy.spots(Math.max(total - filled, 0)) }
}
