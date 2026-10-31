import type { DiscordInviteLink } from '@squadzr/schemas'
import type { PublicSquad } from '@/types'

/** IGDB serves every image in named sizes; the hero art is the largest cover it has. */
const IGDB_IMAGES = 'https://images.igdb.com/igdb/image/upload'

export type DemoGameId = 'valorant' | 'lol' | 'cs2'

/**
 * One game the hero can show: its squad and its key art. The art is the game's IGDB cover, the same
 * image the board shows, so the hero never names a game the catalog does not draw. Squad names and tags
 * are fixed in both languages, like any squad's.
 */
export interface DemoGame {
  readonly id: DemoGameId
  readonly name: string
  /** The switcher's short name. */
  readonly short: string
  readonly slug: string
  /** The IGDB image id of the cover. */
  readonly imageId: string
  /** Where the art's subject sits, from the top, so the stage's band of it shows a face, not a logo. */
  readonly focusY: string
  readonly squad: {
    readonly code: string
    readonly name: string
    readonly tags: readonly string[]
    readonly invite: string
  }
}

export const DEMO_GAMES: readonly DemoGame[] = [
  {
    id: 'valorant',
    name: 'Valorant',
    short: 'Valorant',
    slug: 'valorant',
    imageId: 'co2mvt',
    focusY: '22%',
    squad: {
      code: 'VLR77',
      name: 'Premier quinta à noite',
      tags: ['premier', 'mic'],
      invite: 'premier-qui',
    },
  },
  {
    id: 'lol',
    name: 'League of Legends',
    short: 'LoL',
    slug: 'league-of-legends',
    imageId: 'coc99o',
    focusY: '30%',
    squad: {
      code: 'FLX420',
      name: 'Flex de sexta, sem tilt',
      tags: ['flex', 'ouro'],
      invite: 'flex-sexta',
    },
  },
  {
    id: 'cs2',
    name: 'Counter-Strike 2',
    short: 'CS2',
    slug: 'cs2',
    imageId: 'coaczd',
    focusY: '48%',
    squad: {
      code: 'CS2MIX',
      name: 'Mix de domingo 15k+',
      tags: ['premier', 'mix'],
      invite: 'mix-domingo',
    },
  },
]

/** The game the server HTML shows. */
export const DEFAULT_DEMO_GAME: DemoGame = DEMO_GAMES[0] as DemoGame

/** The cover at the size the hero art takes: 810×1080, enough for the full-width stage. */
export function demoArtUrl(game: DemoGame): string {
  return `${IGDB_IMAGES}/t_1080p/${game.imageId}.jpg`
}

/** The cover at the board's size, for the squad card and the invite. */
export function demoCoverUrl(game: DemoGame): string {
  return `${IGDB_IMAGES}/t_cover_big/${game.imageId}.jpg`
}

/** The invite the Ready panel shows. */
export function demoInvite(game: DemoGame): DiscordInviteLink {
  return {
    href: `https://discord.gg/${game.squad.invite}`,
    host: 'discord.gg/',
    code: game.squad.invite,
  }
}

/** The squad's size, and how many members it has when the demo starts. */
export const DEMO_TOTAL = 5
export const DEMO_FOUNDERS = 2

export interface DemoMember {
  /** Picks the member's initials colours, the same pair the artboard draws. */
  readonly id: string
  /** The name the avatar takes its initials from. */
  readonly name: string
  /** The gamer tag the slot shows; the last member is the viewer, whose tag is translated. */
  readonly tag: string | null
}

/** In join order: the host and one guest are in when the demo starts; the others lock in one by one. */
export const DEMO_MEMBERS: readonly DemoMember[] = [
  { id: 'cc-2', name: 'Caio Cezar', tag: 'caio_cz' },
  { id: 'mf-7', name: 'Mia Ferraz', tag: 'mia.f' },
  { id: 'br-0', name: 'Brunão', tag: 'brunão' },
  { id: 'kz-4', name: 'kz_dex', tag: 'kz_dex' },
  { id: 'lu-4', name: 'You', tag: null },
]

/** The demo squad as the board's card reads it, with the first `filled` members in it. */
export function demoSquad(game: DemoGame, filled: number, youName: string): PublicSquad {
  const members = DEMO_MEMBERS.slice(0, filled).map((member) => ({
    id: member.id,
    name: member.tag === null ? youName : member.name,
    image: null,
  }))
  const now = '2031-06-01T12:00:00.000Z'
  const coverUrl = demoCoverUrl(game)

  return {
    id: '00000000-0000-4000-8000-000000000077',
    code: game.squad.code,
    name: game.squad.name,
    hostId: 'cc-2',
    gameId: '00000000-0000-4000-8000-000000000001',
    game: {
      id: '00000000-0000-4000-8000-000000000001',
      name: game.name,
      slug: game.slug,
      genres: [],
      coverUrl,
      coverThumbUrl: coverUrl,
    },
    maxPlayers: DEMO_TOTAL,
    tags: [...game.squad.tags],
    language: 'pt-br',
    memberCount: filled,
    memberPreview: members,
    createdAt: now,
    updatedAt: now,
  }
}
