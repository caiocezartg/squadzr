import type { WebSocket } from '@fastify/websocket'
import type { Clock } from '@domain/services/clock.interface'

export const RECONNECT_GRACE_MS = 10_000

interface OnlineMember {
  sockets: Set<WebSocket>
  closedAt: number | null
  joinToken: object
}

/** Presence owns no Membership writes; one member may have many transport sessions. */
export class Presence {
  private readonly rooms = new Map<string, Map<string, OnlineMember>>()
  /** Outlives the online entry the sweep deletes; lives in memory only, so a restart forgets it. */
  private readonly offlineSinceByRoom = new Map<string, Map<string, number>>()

  constructor(
    private readonly clock: Clock,
    private readonly transition: (roomCode: string, playerId: string, online: boolean) => void
  ) {}

  join(roomCode: string, userId: string, socket: WebSocket): boolean {
    this.sweep()
    this.forgetOfflineSince(roomCode, userId)
    let room = this.rooms.get(roomCode)
    if (!room) {
      room = new Map()
      this.rooms.set(roomCode, room)
    }
    const member = room.get(userId)
    if (member) {
      member.sockets.add(socket)
      member.closedAt = null
      member.joinToken = {}
      return false
    }
    room.set(userId, { sockets: new Set([socket]), closedAt: null, joinToken: {} })
    return true
  }

  leave(roomCode: string, userId: string, socket: WebSocket): void {
    const member = this.rooms.get(roomCode)?.get(userId)
    if (!member || !member.sockets.delete(socket) || member.sockets.size > 0) return
    member.closedAt = this.clock.now().getTime()
  }

  isOnline(roomCode: string, userId: string): boolean {
    return this.rooms.get(roomCode)?.has(userId) ?? false
  }

  /** When the member's last session closed; null while online or when the server never saw it. */
  offlineSince(roomCode: string, userId: string): Date | null {
    const closedAt = this.offlineSinceByRoom.get(roomCode)?.get(userId)
    return closedAt === undefined ? null : new Date(closedAt)
  }

  /** Local join identities observed before a roster read, independent of clock resolution. */
  captureMembers(roomCode: string): ReadonlyMap<string, object> {
    return new Map(
      [...(this.rooms.get(roomCode) ?? [])].map(([userId, member]) => [userId, member.joinToken])
    )
  }

  retainMembers(
    roomCode: string,
    userIds: Set<string>,
    observed: ReadonlyMap<string, object>
  ): void {
    const room = this.rooms.get(roomCode)
    if (room) {
      for (const [userId, member] of room)
        if (!userIds.has(userId) && observed.get(userId) === member.joinToken) room.delete(userId)
      if (room.size === 0) this.rooms.delete(roomCode)
    }
    for (const userId of this.offlineSinceByRoom.get(roomCode)?.keys() ?? [])
      if (!userIds.has(userId)) this.forgetOfflineSince(roomCode, userId)
  }

  deleteRoom(roomCode: string): void {
    this.rooms.delete(roomCode)
    this.offlineSinceByRoom.delete(roomCode)
  }

  sweep(): void {
    const now = this.clock.now().getTime()
    for (const [roomCode, members] of this.rooms) {
      for (const [userId, member] of members) {
        if (member.closedAt !== null && now >= member.closedAt + RECONNECT_GRACE_MS) {
          members.delete(userId)
          this.rememberOfflineSince(roomCode, userId, member.closedAt)
          this.transition(roomCode, userId, false)
        }
      }
      if (members.size === 0) this.rooms.delete(roomCode)
    }
  }

  clear(): void {
    this.rooms.clear()
    this.offlineSinceByRoom.clear()
  }

  private rememberOfflineSince(roomCode: string, userId: string, closedAt: number): void {
    let room = this.offlineSinceByRoom.get(roomCode)
    if (!room) {
      room = new Map()
      this.offlineSinceByRoom.set(roomCode, room)
    }
    room.set(userId, closedAt)
  }

  private forgetOfflineSince(roomCode: string, userId: string): void {
    const room = this.offlineSinceByRoom.get(roomCode)
    if (!room) return
    room.delete(userId)
    if (room.size === 0) this.offlineSinceByRoom.delete(roomCode)
  }
}
