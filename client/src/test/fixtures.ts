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
} from '@/types'

function hoursAgo(hours: number): Date {
  // Two extra minutes of margin keep the rendered label exactly "Xh ago".
  return new Date(Date.now() - hours * 3_600_000 - 120_000)
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
  status: 'waiting',
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
  status: 'waiting',
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
  status: 'waiting',
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
      status: 'waiting',
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
  status: 'waiting',
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
  status: 'waiting',
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
