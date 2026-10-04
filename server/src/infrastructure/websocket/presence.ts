import type { WebSocket } from '@fastify/websocket'
import type { Clock } from '@domain/services/clock.interface'

export const RECONNECT_GRACE_MS = 10_000

interface OnlineMember {
  sockets: Set<WebSocket>
  offlineAt: number | null
  joinToken: object
}

/** Presence owns no Membership writes; one member may have many transport sessions. */
export class Presence {
  private readonly rooms = new Map<string, Map<string, OnlineMember>>()

  constructor(
    private readonly clock: Clock,
    private readonly transition: (roomCode: string, playerId: string, online: boolean) => void
  ) {}

  join(roomCode: string, userId: string, socket: WebSocket): boolean {
    this.sweep()
    let room = this.rooms.get(roomCode)
    if (!room) {
      room = new Map()
      this.rooms.set(roomCode, room)
    }
    const member = room.get(userId)
    if (member) {
      member.sockets.add(socket)
      member.offlineAt = null
      member.joinToken = {}
      return false
    }
    room.set(userId, { sockets: new Set([socket]), offlineAt: null, joinToken: {} })
    return true
  }

  leave(roomCode: string, userId: string, socket: WebSocket): void {
    const member = this.rooms.get(roomCode)?.get(userId)
    if (!member || !member.sockets.delete(socket) || member.sockets.size > 0) return
    member.offlineAt = this.clock.now().getTime() + RECONNECT_GRACE_MS
  }

  isOnline(roomCode: string, userId: string): boolean {
    return this.rooms.get(roomCode)?.has(userId) ?? false
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
    if (!room) return
    for (const [userId, member] of room)
      if (!userIds.has(userId) && observed.get(userId) === member.joinToken) room.delete(userId)
    if (room.size === 0) this.rooms.delete(roomCode)
  }

  deleteRoom(roomCode: string): void {
    this.rooms.delete(roomCode)
  }

  sweep(): void {
    const now = this.clock.now().getTime()
    for (const [roomCode, members] of this.rooms) {
      for (const [userId, member] of members) {
        if (member.offlineAt !== null && now >= member.offlineAt) {
          members.delete(userId)
          this.transition(roomCode, userId, false)
        }
      }
      if (members.size === 0) this.rooms.delete(roomCode)
    }
  }

  clear(): void {
    this.rooms.clear()
  }
}
