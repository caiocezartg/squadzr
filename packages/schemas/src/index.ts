import { z } from 'zod'

// Room status schema
export const roomStatusSchema = z.enum(['waiting', 'playing', 'finished'])

// User schema
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  image: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type UserDto = z.infer<typeof userSchema>

// Game schema
export const gameSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  coverUrl: z.url(),
  minPlayers: z.number().int(),
  maxPlayers: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type GameDto = z.infer<typeof gameSchema>

// Room schema
export const roomSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  hostId: z.string(),
  gameId: z.uuid(),
  status: roomStatusSchema,
  maxPlayers: z.number().int(),
  discordLink: z.url().nullable(),
  tags: z.array(z.string()).default([]),
  language: z.enum(['en', 'pt-br']).default('pt-br'),
  memberCount: z.number().int().optional(),
  isMember: z.boolean().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
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
  joinedAt: z.coerce.date(),
})

export type RoomMemberDto = z.infer<typeof roomMemberSchema>

// User notification schema
export const userNotificationTypeSchema = z.enum(['room_ready'])

export const userNotificationPayloadSchema = z.object({
  roomId: z.uuid(),
  roomCode: z.string().length(6),
  roomName: z.string(),
  gameName: z.string(),
  players: z.array(z.object({ name: z.string(), image: z.string().nullable() })),
  discordLink: z.url().nullable(),
})

export const userNotificationSchema = z.object({
  id: z.uuid(),
  userId: z.string(),
  type: userNotificationTypeSchema,
  title: z.string(),
  message: z.string(),
  payload: userNotificationPayloadSchema,
  readAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
})

export type UserNotificationDto = z.infer<typeof userNotificationSchema>

// Create room input schema
export const createRoomInputSchema = z.object({
  name: z.string().trim().min(1, 'Room name is required').max(30, 'Room name too long'),
  gameId: z.uuid({ error: 'Invalid game ID' }),
  maxPlayers: z.number().int().min(2).max(20).optional(),
  discordLink: z
    .url({ error: 'Invalid Discord link' })
    .refine(
      (url) =>
        url.startsWith('https://discord.gg/') || url.startsWith('https://discord.com/invite/'),
      { message: 'Discord link must be a valid Discord invite URL' }
    ),
  tags: z
    .array(
      z
        .string()
        .trim()
        .max(15, 'Tag too long')
        .transform((t) => t.replace(/^#+/, '').toLowerCase())
    )
    .max(5, 'Max 5 tags')
    .default([]),
  language: z.enum(['en', 'pt-br']).default('pt-br'),
})

export type CreateRoomInput = z.infer<typeof createRoomInputSchema>

export * from './squad'
