import type { PublicSquad } from '@/types'

/** IGDB serves every image in named sizes; the hero draws covers at the board's size. */
const IGDB_IMAGES = 'https://images.igdb.com/igdb/image/upload'

/** A game's IGDB cover at the size the board's squad card takes. */
export function coverUrl(imageId: string): string {
  return `${IGDB_IMAGES}/t_cover_big/${imageId}.jpg`
}

export interface ShowcaseMember {
  /** Picks the member's initials colours, the same pair the board draws. */
  readonly id: string
  readonly name: string
}

/**
 * One squad of the hero's carousel. The game and its cover are the catalog's own (IGDB), so the hero never
 * draws a game the board does not. Names, tags and members are fixed in both languages, like any squad's.
 */
export interface ShowcaseSquad {
  readonly code: string
  readonly name: string
  readonly game: string
  /** The IGDB image id of the game's cover. */
  readonly coverId: string
  readonly language: PublicSquad['language']
  readonly tags: readonly string[]
  /** Everyone the squad ends with, in join order. Its size is the squad's. */
  readonly members: readonly ShowcaseMember[]
  /** How many members are in when the squad reaches the centre; the rest join one by one. */
  readonly founders: number
}

export const SHOWCASE_SQUADS: readonly ShowcaseSquad[] = [
  {
    code: 'VLR77X',
    name: 'Premier quinta à noite',
    game: 'Valorant',
    coverId: 'cocqbp',
    language: 'pt-br',
    tags: ['premier', 'mic'],
    founders: 2,
    members: [
      { id: 'cc-2', name: 'caio_cz' },
      { id: 'mf-7', name: 'mia.f' },
      { id: 'br-0', name: 'brunão' },
      { id: 'kz-4', name: 'kz_dex' },
      { id: 'lu-4', name: 'luiza' },
    ],
  },
  {
    code: 'APX3RD',
    name: 'Trio ranked até Diamante',
    game: 'Apex Legends',
    coverId: 'cocqh2',
    language: 'pt-br',
    tags: ['ranked', 'trio'],
    founders: 1,
    members: [
      { id: 'rx-1', name: 'rafa.exe' },
      { id: 'vt-9', name: 'vitinho' },
      { id: 'jn-3', name: 'jana' },
    ],
  },
  {
    code: 'FLX420',
    name: 'Flex de sexta, sem tilt',
    game: 'League of Legends',
    coverId: 'coc99o',
    language: 'pt-br',
    tags: ['flex', 'ouro'],
    founders: 2,
    members: [
      { id: 'th-5', name: 'thiagão' },
      { id: 'ps-2', name: 'pseudo' },
      { id: 'an-8', name: 'ana.lu' },
      { id: 'gb-6', name: 'gabs' },
      { id: 'mk-1', name: 'mkz' },
    ],
  },
  {
    code: 'LTHL04',
    name: 'Cota batida antes da meia-noite',
    game: 'Lethal Company',
    coverId: 'co5ive',
    language: 'pt-br',
    tags: ['casual', 'mic'],
    founders: 1,
    members: [
      { id: 'dn-3', name: 'dani' },
      { id: 'ot-7', name: 'otávio' },
      { id: 'lc-2', name: 'lucca' },
      { id: 'be-5', name: 'bea' },
    ],
  },
  {
    code: 'CS2MIX',
    name: 'Mix de domingo 15k+',
    game: 'Counter-Strike 2',
    coverId: 'coaczd',
    language: 'pt-br',
    tags: ['premier', 'mix'],
    founders: 3,
    members: [
      { id: 'fx-4', name: 'fxzin' },
      { id: 'rd-1', name: 'rdz' },
      { id: 'nk-9', name: 'nk' },
      { id: 'tt-2', name: 'tuts' },
      { id: 'hl-6', name: 'helô' },
    ],
  },
  {
    code: 'RLDUO2',
    name: 'Duplas 2v2, subindo pro Champ',
    game: 'Rocket League',
    coverId: 'cocyri',
    language: 'pt-br',
    tags: ['2v2', 'ranked'],
    founders: 1,
    members: [
      { id: 'zk-8', name: 'zika' },
      { id: 'md-3', name: 'mand' },
    ],
  },
  {
    code: 'DOTA5S',
    name: 'Turbo depois da aula',
    game: 'Dota 2',
    coverId: 'cobfk4',
    language: 'pt-br',
    tags: ['turbo', 'mic'],
    founders: 2,
    members: [
      { id: 'pd-1', name: 'pedrin' },
      { id: 'cl-5', name: 'clara' },
      { id: 'ig-0', name: 'igor' },
      { id: 'yu-2', name: 'yuki' },
      { id: 'ms-7', name: 'mase' },
    ],
  },
]

/** The squad's size: everyone it ends with. */
export function squadSize(squad: ShowcaseSquad): number {
  return squad.members.length
}

/**
 * The covers the hero's backdrop drifts through, all from the catalog. The wall reads them in columns, so
 * neighbours in this list end up far apart on screen.
 */
export const WALL_COVER_IDS: readonly string[] = [
  'cocqbp',
  'coc99o',
  'coaczd',
  'cobfk4',
  'cocqh2',
  'cocxbi',
  'cod2we',
  'cocyri',
  'co5ive',
  'co9rk1',
  'cocsnm',
  'co6kqt',
  'coaam4',
  'co5zky',
  'coc89g',
  'coabbf',
  'cocsmb',
  'cod6ev',
  'co7n02',
  'co8fu7',
  'coco22',
  'co2558',
  'coamcz',
  'co1y2f',
  'cocygu',
  'co9wxo',
  'coa7cs',
  'coajjj',
  'co2dto',
  'cob22v',
  'co4jni',
  'co904o',
  'coctqy',
  'co6i3u',
  'co1sh2',
  'co2lbd',
]
