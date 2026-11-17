/**
 * The widths the hero lays itself out for: phones (below 768px, where each line of the headline takes
 * two), tablets (768px to 1279px) and wide screens (from 1280px, where all six chips fit).
 */
export type HeroTier = 'phone' | 'tablet' | 'wide'

/** A point measured from the top centre of the headline, x to the right and y down, in headline ems. */
export type HeroSpot = readonly [x: number, y: number]

/** Where something floats in each tier; a chip with no spot in a tier stays out of it. */
export type HeroSpots = Readonly<Partial<Record<HeroTier, HeroSpot>>>

export type SoloChipKey = 'queue' | 'friends' | 'lobby' | 'invite' | 'searching' | 'duo'

/** One sign of playing solo, floating around the headline until the strike. */
export interface SoloChip {
  readonly key: SoloChipKey
  readonly spots: HeroSpots
  /** Its lean, in degrees, so the chips look dropped rather than laid out. */
  readonly tilt: number
  /** When it rises in, among the chips: the queue first, the duo last. */
  readonly rank: number
}

/**
 * The solo life, close around the headline: two above it, the rest in the empty line where "build your
 * squad" rises later. Phones and tablets keep four; the lobby's 1/5 repeats the counter below and the
 * friends chip has no room there.
 */
export const SOLO_CHIPS: readonly SoloChip[] = [
  {
    key: 'queue',
    spots: { phone: [-1.52, -1.03], tablet: [-2.6, -0.6], wide: [-2.92, -0.55] },
    tilt: -3,
    rank: 0,
  },
  { key: 'friends', spots: { wide: [2.92, -0.64] }, tilt: 2.5, rank: 4 },
  { key: 'lobby', spots: { wide: [-3.61, 1.49] }, tilt: -2, rank: 2 },
  {
    key: 'invite',
    spots: { phone: [-0.9, 2.71], tablet: [-2.3, 1.3], wide: [3.47, 1.57] },
    tilt: 3,
    rank: 3,
  },
  {
    key: 'searching',
    spots: { phone: [0.9, 3.6], tablet: [2.2, 1.75], wide: [0, 1.65] },
    tilt: 1.5,
    rank: 1,
  },
  {
    key: 'duo',
    spots: { phone: [1.66, -0.73], tablet: [2.5, -0.65], wide: [-4.03, 2.84] },
    tilt: -2.5,
    rank: 5,
  },
]

/** A player who joins the visitor's squad: drawn like any member, floating at its spot until it flies in. */
export interface Squadmate {
  /** Picks the member's initials colours, the same pair the board draws. */
  readonly id: string
  readonly name: string
  readonly spots: Readonly<Record<HeroTier, HeroSpot>>
}

/**
 * The four who complete the visitor's squad, in the order they land, close around the lettering: from
 * 768px two flank the first line and two the squad's rail; on phones two flank "solo" and two the line
 * where "build your squad" rises, between the chips. All stay inside the hero at any width of their tier.
 */
export const SQUADMATES: readonly Squadmate[] = [
  {
    id: 'mf-7',
    name: 'mia.f',
    spots: { phone: [2.2, 1.6], tablet: [5, 0.45], wide: [5, 0.45] },
  },
  {
    id: 'br-0',
    name: 'brunão',
    spots: { phone: [-2.2, 1.6], tablet: [-5, 0.45], wide: [-5, 0.45] },
  },
  {
    id: 'kz-4',
    name: 'kz_dex',
    spots: { phone: [2.3, 2.75], tablet: [3.6, 2.9], wide: [3.2, 2.75] },
  },
  {
    id: 'lu-4',
    name: 'luiza',
    spots: { phone: [-2.3, 3.6], tablet: [-3.6, 2.9], wide: [-2.6, 2.75] },
  },
]

/** The squad the hero completes: the visitor and the four who join. */
export const SQUAD_SIZE = SQUADMATES.length + 1
