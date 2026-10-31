/**
 * The squad the hero demo shows (docs/design/Main.dc.html). It is an illustration, so its content is
 * fixed in both languages, like any squad's name and tags. The ids pick the initials colours the
 * artboard draws for each member.
 */
export const DEMO_SQUAD = {
  game: 'VALORANT',
  code: '#VLR77',
  name: 'Premier quinta à noite',
  language: 'Português (BR)',
  tags: ['premier', 'mic'],
  invite: 'discord.gg/premier-qui',
  /** A Valorant cover from IGDB, as every cover on the app is. */
  coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co2mvt.jpg',
} as const

export interface DemoMember {
  readonly playerId: string
  readonly name: string
  readonly host?: boolean
}

/** In join order: the first two are in the squad when the demo starts, the rest join one by one. */
export const DEMO_MEMBERS: readonly DemoMember[] = [
  { playerId: 'cc-2', name: 'Caio Cezar', host: true },
  { playerId: 'mf-7', name: 'Mia Ferraz' },
  { playerId: 'br-0', name: 'Brunão' },
  { playerId: 'kz-4', name: 'kz_dex' },
  { playerId: 'lu-4', name: 'luhzinha' },
]
