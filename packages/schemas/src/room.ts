import { z } from 'zod'
import { isoDateTimeSchema } from './date'
import { discordInviteCode } from './discord'
import { gameSummarySchema } from './game'

export const roomLanguageSchema = z.enum(['en', 'pt-br'])

// The most members a Squad's preview carries.
export const MEMBER_PREVIEW_LIMIT = 5

// One member in a Squad's preview: just enough to draw an avatar and a name.
export const memberPreviewSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
})

export type MemberPreviewDto = z.infer<typeof memberPreviewSchema>

// Public room projection: what the catalog and guest realtime events may carry.
// It carries a preview of up to five members (host first, then by join time),
// never the full roster or the invite. It also never holds the internal
// lifecycle timestamps (`readyAt` / `lastActivityAt`): readiness is not part of
// the coordinated HTTP contract.
export const publicRoomSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  hostId: z.string(),
  gameId: z.uuid(),
  // The Squad's Game summary: `gameId` stays for clients that still resolve the
  // catalog themselves.
  game: gameSummarySchema,
  maxPlayers: z.number().int(),
  tags: z.array(z.string()).default([]),
  language: roomLanguageSchema.default('pt-br'),
  memberCount: z.number().int().optional(),
  memberPreview: z.array(memberPreviewSchema).max(MEMBER_PREVIEW_LIMIT),
  isMember: z.boolean().optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export type PublicRoomDto = z.infer<typeof publicRoomSchema>

// Private room projection: the public one plus the Discord invite, delivered
// only to authenticated members of the room.
export const roomSchema = publicRoomSchema.extend({
  discordLink: z.url().nullable(),
})

export type RoomDto = z.infer<typeof roomSchema>

// Player schema (used in room lobby)
export const playerSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  isHost: z.boolean(),
})

export type PlayerDto = z.infer<typeof playerSchema>

// Room member schema
export const roomMemberSchema = z.object({
  id: z.uuid(),
  roomId: z.uuid(),
  userId: z.string(),
  joinedAt: isoDateTimeSchema,
})

export type RoomMemberDto = z.infer<typeof roomMemberSchema>

// Create room input schema
export const createRoomInputSchema = z.object({
  name: z.string().trim().min(1, 'Room name is required').max(30, 'Room name too long'),
  gameId: z.uuid({ error: 'Invalid game ID' }),
  maxPlayers: z.number().int().min(2).max(40).optional(),
  discordLink: z
    .url({ error: 'Invalid Discord link' })
    .refine((url) => discordInviteCode(url) !== null, {
      message: 'Discord link must be a valid Discord invite URL',
    }),
  tags: z
    .array(
      z
        .string()
        .trim()
        .transform((t) => t.replace(/^#+/, '').toLowerCase())
        .pipe(
          z
            .string()
            .max(12, 'Tag too long')
            .regex(/^[\p{L}\p{N}-]+$/u, 'Tag must be one word')
        )
    )
    .max(5, 'Max 5 tags')
    .default([]),
  language: roomLanguageSchema.default('pt-br'),
})

export type CreateRoomInput = z.infer<typeof createRoomInputSchema>

// URL param validation with uppercase transform
export const roomCodeParamSchema = z.object({
  code: z
    .string()
    .length(6)
    .transform((val) => val.toUpperCase()),
})

// Room HTTP responses
export const roomsResponseSchema = z.object({ rooms: z.array(publicRoomSchema) })

export type RoomsResponse = z.infer<typeof roomsResponseSchema>

export const myRoomsResponseSchema = z.object({
  hosted: z.array(roomSchema),
  joined: z.array(roomSchema),
})

export type MyRoomsResponse = z.infer<typeof myRoomsResponseSchema>

export const createRoomResponseSchema = z.object({ room: roomSchema })

export type CreateRoomResponse = z.infer<typeof createRoomResponseSchema>

// Lobby details: Discord invite and roster, for authenticated members only.
export const roomLobbyResponseSchema = z.object({
  room: roomSchema,
  players: z.array(playerSchema),
})

export type RoomLobbyResponse = z.infer<typeof roomLobbyResponseSchema>

// Non-member answer: the public projection and nothing else (its member preview
// is not the roster). A payload that carries a roster or an invite claims to be
// lobby details, so it is refused here instead of being stripped down to a
// public room: it has to satisfy `roomLobbyResponseSchema` in full or fail.
const publicRoomResponseSchema = z.object({
  room: publicRoomSchema.extend({ discordLink: z.never().optional() }),
  players: z.never().optional(),
})

// `GET /api/rooms/:code` answers members with the lobby details and everyone
// else with the public projection.
export const roomResponseSchema = z.union([roomLobbyResponseSchema, publicRoomResponseSchema])

export type RoomResponse = z.infer<typeof roomResponseSchema>

export function isRoomLobbyResponse(response: RoomResponse): response is RoomLobbyResponse {
  return response.players !== undefined
}

export const joinRoomResponseSchema = z.object({
  message: z.string(),
  roomMember: roomMemberSchema,
})

export type JoinRoomResponse = z.infer<typeof joinRoomResponseSchema>

export const leaveRoomResponseSchema = z.object({
  message: z.string(),
  success: z.boolean(),
})
