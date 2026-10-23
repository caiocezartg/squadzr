/**
 * Deterministic domain fixtures for the squad-flow tests. Dates are computed
 * relative to the moment the module is imported so relative-time rendering
 * ("2h ago") stays stable for the duration of a test file.
 */

import type {
  Game,
  GamesResponse,
  Player,
  RoomResponse,
  RoomsResponse,
  Squad,
  UserNotification,
} from '@/types'
import type { WsServerEventPayload } from '@squadzr/schemas/ws'

/** ISO 8601 string, as transport dates travel in JSON. */
function hoursAgo(hours: number): string {
  // Two extra minutes of margin keep the rendered label exactly "Xh ago".
  return new Date(Date.now() - hours * 3_600_000 - 120_000).toISOString()
}

export const gameLol: Game = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'League of Legends',
  slug: 'lol',
  coverUrl: 'https://cdn.squadzr.test/covers/lol.jpg',
  minPlayers: 1,
  maxPlayers: 5,
  createdAt: hoursAgo(24),
  updatedAt: hoursAgo(24),
}

export const gameCs2: Game = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Counter-Strike 2',
  slug: 'cs2',
  coverUrl: 'https://cdn.squadzr.test/covers/cs2.jpg',
  minPlayers: 1,
  maxPlayers: 5,
  createdAt: hoursAgo(24),
  updatedAt: hoursAgo(24),
}

/** Game summary every Squad carries next to `gameId` (CCC-92). */
export const gameLolSummary = {
  id: gameLol.id,
  name: gameLol.name,
  slug: gameLol.slug,
  genres: [{ slug: 'moba', name: 'MOBA' }],
  coverUrl: gameLol.coverUrl,
  coverThumbUrl: 'https://cdn.squadzr.test/covers/lol-thumb.jpg',
}

export const gameCs2Summary = {
  id: gameCs2.id,
  name: gameCs2.name,
  slug: gameCs2.slug,
  genres: [{ slug: 'shooter', name: 'Shooter' }],
  coverUrl: gameCs2.coverUrl,
  coverThumbUrl: 'https://cdn.squadzr.test/covers/cs2-thumb.jpg',
}

export const boardGames: GamesResponse = {
  games: [gameLol, gameCs2],
}

/** Open squad with free slots — joinable by a signed-in user. */
export const openSquad: Squad = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  code: 'ABC123',
  name: 'Ranked grind',
  hostId: 'user-9',
  gameId: gameLol.id,
  game: gameLolSummary,
  maxPlayers: 5,
  discordLink: 'https://discord.gg/open',
  tags: ['ranked', 'chill'],
  language: 'en',
  memberCount: 1,
  isMember: false,
  createdAt: hoursAgo(2),
  updatedAt: hoursAgo(2),
}

/** Squad already at capacity — join is disabled for non-members. */
export const fullSquad: Squad = {
  id: 'aaaaaaaa-0000-4000-8000-000000000002',
  code: 'XYZ789',
  name: 'Full lobby',
  hostId: 'user-9',
  gameId: gameCs2.id,
  game: gameCs2Summary,
  maxPlayers: 4,
  discordLink: null,
  tags: [],
  language: 'pt-br',
  memberCount: 4,
  isMember: false,
  createdAt: hoursAgo(4),
  updatedAt: hoursAgo(4),
}

/** Squad the signed-in user already belongs to. */
export const memberSquad: Squad = {
  id: 'aaaaaaaa-0000-4000-8000-000000000003',
  code: 'MEM111',
  name: 'Casual five stack',
  hostId: 'user-9',
  gameId: gameLol.id,
  game: gameLolSummary,
  maxPlayers: 4,
  discordLink: null,
  tags: ['chill'],
  language: 'pt-br',
  memberCount: 3,
  isMember: true,
  createdAt: hoursAgo(6),
  updatedAt: hoursAgo(6),
}

export const boardSquads: RoomsResponse = {
  rooms: [openSquad, fullSquad, memberSquad],
}

export function squadsForPagination(): RoomsResponse {
  const squads = Array.from({ length: 7 }, (_, i) => {
    const index = i + 1
    const squad: Squad = {
      id: `aaaaaaaa-0000-4000-8000-00000000001${index}`,
      code: `P${String(index).padStart(5, '0')}`,
      name: `Page squad ${index}`,
      hostId: 'user-9',
      gameId: gameLol.id,
      game: gameLolSummary,
      maxPlayers: 5,
      discordLink: null,
      tags: [],
      language: 'en',
      memberCount: 1,
      isMember: false,
      createdAt: hoursAgo(index + 5),
      updatedAt: hoursAgo(index + 5),
    }
    return squad
  })
  return { rooms: squads }
}

export const lobbySquad: Squad = {
  id: 'aaaaaaaa-0000-4000-8000-000000000004',
  code: 'LOBBY1',
  name: 'Squad ready check',
  hostId: 'user-1',
  gameId: gameLol.id,
  game: gameLolSummary,
  maxPlayers: 3,
  discordLink: 'https://discord.gg/lobby',
  tags: ['squad'],
  language: 'en',
  createdAt: hoursAgo(1),
  updatedAt: hoursAgo(1),
}

export const hostPlayer: Player = {
  id: 'user-1',
  name: 'Caio',
  image: null,
  isHost: true,
}

export const guestPlayer: Player = {
  id: 'user-2',
  name: 'Ana',
  image: 'https://cdn.squadzr.test/players/ana.png',
  isHost: false,
}

export const lobbySquadResponse: RoomResponse = {
  room: lobbySquad,
  players: [hostPlayer],
}

export const createdSquad: Squad = {
  id: 'aaaaaaaa-0000-4000-8000-000000000006',
  code: 'NEW001',
  name: 'Created squad',
  hostId: 'user-1',
  gameId: gameLol.id,
  game: gameLolSummary,
  maxPlayers: 5,
  discordLink: 'https://discord.gg/created',
  tags: ['ranked'],
  language: 'pt-br',
  memberCount: 1,
  isMember: true,
  createdAt: hoursAgo(0),
  updatedAt: hoursAgo(0),
}

type LobbySnapshot = WsServerEventPayload<'room_snapshot'>

/**
 * Authoritative squad snapshot as the server sends it after every subscribe or resubscribe: member
 * projection, complete roster, readiness, expiration and per-member Presence.
 */
export function lobbySnapshot(overrides: Partial<LobbySnapshot> = {}): LobbySnapshot {
  return {
    room: { ...lobbySquad, memberCount: 2, isMember: true },
    players: [hostPlayer, guestPlayer],
    readyAt: null,
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    presence: [
      { playerId: hostPlayer.id, online: true },
      { playerId: guestPlayer.id, online: false },
    ],
    ...overrides,
  }
}

/** Snapshot of a full room whose last Membership made it ready. */
export function readyLobbySnapshot(overrides: Partial<LobbySnapshot> = {}): LobbySnapshot {
  return lobbySnapshot({
    readyAt: new Date().toISOString(),
    presence: [
      { playerId: hostPlayer.id, online: true },
      { playerId: guestPlayer.id, online: true },
    ],
    ...overrides,
  })
}

export const squadReadyNotification: UserNotification = {
  id: '9b2f7a1e-4c3d-4e5f-8a6b-1c2d3e4f5a6b',
  userId: 'user-1',
  type: 'room_ready',
  title: 'Your squad is ready',
  message: 'Squad ready check is full. The Discord invite is available.',
  payload: {
    roomId: lobbySquad.id,
    roomCode: lobbySquad.code,
    roomName: lobbySquad.name,
    gameName: gameLol.name,
    players: [{ name: hostPlayer.name, image: hostPlayer.image }],
    discordLink: lobbySquad.discordLink,
  },
  readAt: null,
  createdAt: hoursAgo(0),
}
