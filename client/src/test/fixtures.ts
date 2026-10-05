/**
 * Deterministic domain fixtures for the room-flow tests. Dates are computed
 * relative to the moment the module is imported so relative-time rendering
 * ("2h ago") stays stable for the duration of a test file.
 */

import type {
  CreateRoomResponse,
  Game,
  GamesResponse,
  Player,
  Room,
  RoomResponse,
  RoomsResponse,
  UserNotification,
} from '@/types'
import type { JoinRoomResponse } from '@squadzr/schemas'
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

export const catalogGames: GamesResponse = {
  games: [gameLol, gameCs2],
}

/** Open room with free slots — joinable by a signed-in user. */
export const openRoom: Room = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  code: 'ABC123',
  name: 'Ranked grind',
  hostId: 'user-9',
  gameId: gameLol.id,
  maxPlayers: 5,
  discordLink: 'https://discord.gg/open',
  tags: ['ranked', 'chill'],
  language: 'en',
  memberCount: 1,
  isMember: false,
  createdAt: hoursAgo(2),
  updatedAt: hoursAgo(2),
}

/** Room already at capacity — join is disabled for non-members. */
export const fullRoom: Room = {
  id: 'aaaaaaaa-0000-4000-8000-000000000002',
  code: 'XYZ789',
  name: 'Full lobby',
  hostId: 'user-9',
  gameId: gameCs2.id,
  maxPlayers: 4,
  discordLink: null,
  tags: [],
  language: 'pt-br',
  memberCount: 4,
  isMember: false,
  createdAt: hoursAgo(4),
  updatedAt: hoursAgo(4),
}

/** Room the signed-in user already belongs to. */
export const memberRoom: Room = {
  id: 'aaaaaaaa-0000-4000-8000-000000000003',
  code: 'MEM111',
  name: 'Casual five stack',
  hostId: 'user-9',
  gameId: gameLol.id,
  maxPlayers: 4,
  discordLink: null,
  tags: ['chill'],
  language: 'pt-br',
  memberCount: 3,
  isMember: true,
  createdAt: hoursAgo(6),
  updatedAt: hoursAgo(6),
}

export const catalogRooms: RoomsResponse = {
  rooms: [openRoom, fullRoom, memberRoom],
}

export function roomsForPagination(): RoomsResponse {
  const rooms = Array.from({ length: 7 }, (_, i) => {
    const index = i + 1
    const room: Room = {
      id: `aaaaaaaa-0000-4000-8000-00000000001${index}`,
      code: `P${String(index).padStart(5, '0')}`,
      name: `Page room ${index}`,
      hostId: 'user-9',
      gameId: gameLol.id,
      maxPlayers: 5,
      discordLink: null,
      tags: [],
      language: 'en',
      memberCount: 1,
      isMember: false,
      createdAt: hoursAgo(index + 5),
      updatedAt: hoursAgo(index + 5),
    }
    return room
  })
  return { rooms }
}

export const lobbyRoom: Room = {
  id: 'aaaaaaaa-0000-4000-8000-000000000004',
  code: 'LOBBY1',
  name: 'Squad ready check',
  hostId: 'user-1',
  gameId: gameLol.id,
  maxPlayers: 3,
  discordLink: 'https://discord.gg/lobby',
  tags: ['squad'],
  language: 'en',
  createdAt: hoursAgo(1),
  updatedAt: hoursAgo(1),
}

export const invalidDiscordRoom: Room = {
  ...lobbyRoom,
  id: 'aaaaaaaa-0000-4000-8000-000000000005',
  code: 'BADLNK',
  discordLink: 'https://not-discord.example/invite',
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

export const lobbyRoomResponse: RoomResponse = {
  room: lobbyRoom,
  players: [hostPlayer],
}

export const invalidDiscordRoomResponse: RoomResponse = {
  room: invalidDiscordRoom,
  players: [hostPlayer],
}

export const createdRoom: Room = {
  id: 'aaaaaaaa-0000-4000-8000-000000000006',
  code: 'NEW001',
  name: 'Created squad',
  hostId: 'user-1',
  gameId: gameLol.id,
  maxPlayers: 5,
  discordLink: 'https://discord.gg/created',
  tags: ['ranked'],
  language: 'pt-br',
  memberCount: 1,
  isMember: true,
  createdAt: hoursAgo(0),
  updatedAt: hoursAgo(0),
}

export const createRoomResponse: CreateRoomResponse = {
  room: createdRoom,
}

/**
 * Contract-valid answer for `POST /api/rooms/:code/join`; the join flow parses
 * it with `joinRoomResponseSchema`, so an `{ ok: true }` stub is not a valid
 * substitute.
 */
export const joinRoomResponse: JoinRoomResponse = {
  message: 'Joined squad',
  roomMember: {
    id: 'bbbbbbbb-0000-4000-8000-000000000001',
    roomId: openRoom.id,
    userId: 'user-1',
    joinedAt: hoursAgo(0),
  },
}

export type LobbySnapshot = WsServerEventPayload<'room_snapshot'>

/**
 * Authoritative room snapshot as the server sends it after every subscribe or
 * resubscribe: member room projection, complete roster, readiness, expiration
 * and per-member Presence.
 */
export function lobbySnapshot(overrides: Partial<LobbySnapshot> = {}): LobbySnapshot {
  return {
    room: { ...lobbyRoom, memberCount: 2, isMember: true },
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

export const roomReadyNotification: UserNotification = {
  id: '9b2f7a1e-4c3d-4e5f-8a6b-1c2d3e4f5a6b',
  userId: 'user-1',
  type: 'room_ready',
  title: 'Your squad is ready',
  message: 'Squad ready check is full. The Discord invite is available.',
  payload: {
    roomId: lobbyRoom.id,
    roomCode: lobbyRoom.code,
    roomName: lobbyRoom.name,
    gameName: gameLol.name,
    players: [{ name: hostPlayer.name, image: hostPlayer.image }],
    discordLink: lobbyRoom.discordLink,
  },
  readAt: null,
  createdAt: hoursAgo(0),
}
