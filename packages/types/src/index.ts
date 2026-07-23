// Room status enum
export type RoomStatus = 'waiting' | 'playing' | 'finished'

// User entity (matches Better Auth user table)
export type User = {
  id: string
  name: string
  email: string
  image: string | null
  createdAt: Date
  updatedAt: Date
}

// Game entity
export type Game = {
  id: string
  name: string
  slug: string
  coverUrl: string
  minPlayers: number
  maxPlayers: number
  createdAt: Date
  updatedAt: Date
}

// Room entity
export type Room = {
  id: string
  code: string
  name: string
  hostId: string
  gameId: string
  status: RoomStatus
  maxPlayers: number
  discordLink: string | null
  tags: string[]
  language: 'en' | 'pt-br'
  memberCount?: number
  isMember?: boolean
  createdAt: Date
  updatedAt: Date
}

// RoomMember entity
export type RoomMember = {
  id: string
  roomId: string
  userId: string
  joinedAt: Date
}

export type UserNotificationType = 'room_ready'

export type UserNotificationPayload = {
  roomId: string
  roomCode: string
  roomName: string
  gameName: string
  players: { name: string; image: string | null }[]
  discordLink: string | null
}

export type UserNotification = {
  id: string
  userId: string
  type: UserNotificationType
  title: string
  message: string
  payload: UserNotificationPayload
  readAt: Date | null
  createdAt: Date
}

// API Response Types
export type {
  RoomsResponse,
  RoomResponse,
  GamesResponse,
  GameResponse,
  CreateRoomResponse,
  NotificationsResponse,
  MyRoomsResponse,
} from './api'

// WebSocket Payload Types
export type {
  Player,
  RoomCreatedPayload,
  RoomUpdatedPayload,
  RoomDeletedPayload,
  RoomJoinedPayload,
  PlayerJoinedPayload,
  PlayerLeftPayload,
  RoomReadyPayload,
  WsErrorPayload,
} from './ws'

export type {
  MemberReadySquad,
  MemberRecruitingSquad,
  MemberSquad,
  MembershipRole,
  PublicRecruitingSquad,
  ReadyNotification,
  SquadLanguage,
  SquadLifecycleState,
  SquadRosterMembership,
} from './squad'
