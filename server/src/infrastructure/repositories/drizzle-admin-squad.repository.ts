import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm'
import type {
  AdminSquad,
  AdminSquadDetail,
  AdminSquadMember,
  ClosedSquad,
} from '@domain/entities/admin-squad.entity'
import type {
  CloseOpenSquadInput,
  CloseOpenSquadOutcome,
  IAdminSquadRepository,
  ListOpenSquadsQuery,
  OpenSquadPage,
} from '@domain/repositories/admin-squad.repository'
import type { Clock } from '@domain/services/clock.interface'
import type { Database } from '@infrastructure/database/drizzle'
import { user } from '@infrastructure/database/schema/auth'
import { games } from '@infrastructure/database/schema/games'
import { roomMembers } from '@infrastructure/database/schema/room-members'
import { rooms, type RoomRow } from '@infrastructure/database/schema/rooms'
import { userNotifications } from '@infrastructure/database/schema/user-notifications'
import { insertAuditEntry } from './audit-entry-writer'
import { isValidOpenRoom, validOpenRoomCondition } from './open-room-rules'
import { notificationInputToRow, mapUserNotificationRow } from './user-notification-mapping'

/** Members of a Squad, counted inside the database so a page of Squads is still one query. */
const memberCountColumn = sql<number>`(
  select count(*)::int from room_members counted_member where counted_member.room_id = ${rooms.id}
)`

const listColumns = {
  room: rooms,
  gameName: games.name,
  gameThumbnailUrl: games.thumbnailUrl,
  hostName: user.name,
  memberCount: memberCountColumn,
} as const

interface ListRow {
  readonly room: RoomRow
  readonly gameName: string
  readonly gameThumbnailUrl: string
  readonly hostName: string
  readonly memberCount: number
}

function mapListRow(row: ListRow): AdminSquad {
  return {
    id: row.room.id,
    code: row.room.code,
    name: row.room.name,
    game: { id: row.room.gameId, name: row.gameName, coverThumbUrl: row.gameThumbnailUrl },
    platform: row.room.platform as AdminSquad['platform'],
    host: { id: row.room.hostId, name: row.hostName },
    memberCount: row.memberCount,
    maxPlayers: row.room.maxPlayers,
    createdAt: row.room.createdAt,
    lastActivityAt: row.room.lastActivityAt,
  }
}

/** The search term as a `LIKE` pattern: a leading `#` of a displayed code is dropped, wildcards are literal. */
function searchPattern(search: string): string | null {
  const term = search.trim().replace(/^#/, '').trim()
  if (term === '') return null
  return `%${term.replace(/[\\%_]/g, (character) => `\\${character}`)}%`
}

function searchCondition(search: string | undefined): SQL | undefined {
  const pattern = search === undefined ? null : searchPattern(search)
  if (pattern === null) return undefined
  return or(ilike(rooms.name, pattern), ilike(rooms.code, pattern), ilike(user.name, pattern))
}

export class DrizzleAdminSquadRepository implements IAdminSquadRepository {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock
  ) {}

  async listOpen(query: ListOpenSquadsQuery): Promise<OpenSquadPage> {
    const where = and(
      validOpenRoomCondition(this.clock.now()),
      query.gameId === undefined ? undefined : eq(rooms.gameId, query.gameId),
      searchCondition(query.search)
    )

    const [rows, totals] = await Promise.all([
      this.db
        .select(listColumns)
        .from(rooms)
        .innerJoin(games, eq(games.id, rooms.gameId))
        .innerJoin(user, eq(user.id, rooms.hostId))
        .where(where)
        .orderBy(desc(rooms.createdAt), desc(rooms.id))
        .limit(query.limit)
        .offset(query.offset),
      this.db
        .select({ total: count() })
        .from(rooms)
        .innerJoin(user, eq(user.id, rooms.hostId))
        .where(where),
    ])

    return { squads: rows.map(mapListRow), total: totals[0]?.total ?? 0 }
  }

  async findOpenById(id: string): Promise<AdminSquadDetail | null> {
    const rows = await this.db
      .select({ ...listColumns, discordLink: rooms.discordLink })
      .from(rooms)
      .innerJoin(games, eq(games.id, rooms.gameId))
      .innerJoin(user, eq(user.id, rooms.hostId))
      .where(and(eq(rooms.id, id), validOpenRoomCondition(this.clock.now())))
      .limit(1)
    const row = rows[0]
    if (!row) return null

    const memberRows = await this.db
      .select({
        id: user.id,
        name: user.name,
        image: user.image,
        joinedAt: roomMembers.joinedAt,
      })
      .from(roomMembers)
      .innerJoin(user, eq(user.id, roomMembers.userId))
      .where(eq(roomMembers.roomId, id))
      .orderBy(asc(roomMembers.joinedAt), asc(user.id))

    const members: AdminSquadMember[] = memberRows
      .map((member) => ({ ...member, isHost: member.id === row.room.hostId }))
      .sort((a, b) => Number(b.isHost) - Number(a.isHost))

    return {
      ...mapListRow(row),
      language: row.room.language as AdminSquadDetail['language'],
      discordLink: row.discordLink,
      members,
    }
  }

  async closeOpenSquad(input: CloseOpenSquadInput): Promise<CloseOpenSquadOutcome> {
    return this.db.transaction(async (tx) => {
      // The same lock the leave path and the filling join take: this closure either commits before a
      // join sees the Squad (which then finds it gone) or waits until that join has made it Ready.
      const roomRows = await tx
        .select()
        .from(rooms)
        .where(eq(rooms.id, input.roomId))
        .limit(1)
        .for('update')
      const room = roomRows[0]
      if (!room) return { status: 'not_found' }

      const now = this.clock.now()
      if (!isValidOpenRoom(room, now)) {
        return { status: 'not_open' }
      }

      const squad = await readClosedSquad(tx, room)

      // The Memberships go with the Squad by cascade.
      await tx.delete(rooms).where(eq(rooms.id, room.id))

      const notificationInputs = input.buildNotifications(squad)
      const notificationRows =
        notificationInputs.length === 0
          ? []
          : await tx
              .insert(userNotifications)
              .values(notificationInputs.map(notificationInputToRow))
              .returning()
      await insertAuditEntry(tx, input.buildAuditEntry(squad, now))

      return {
        status: 'closed',
        roomId: room.id,
        roomCode: room.code,
        notifications: notificationRows.map(mapUserNotificationRow),
      }
    })
  }
}

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

/** The Squad as the closure snapshots it, read under the Squad lock: its Game and every member. */
async function readClosedSquad(tx: Transaction, room: RoomRow): Promise<ClosedSquad> {
  const gameRows = await tx
    .select({ name: games.name, coverUrl: games.coverUrl })
    .from(games)
    .where(eq(games.id, room.gameId))
  const memberRows = await tx
    .select({ userId: roomMembers.userId })
    .from(roomMembers)
    .where(eq(roomMembers.roomId, room.id))
    .orderBy(asc(roomMembers.joinedAt), asc(roomMembers.userId))
  const game = gameRows[0]

  return {
    roomId: room.id,
    roomCode: room.code,
    roomName: room.name,
    gameName: game?.name ?? 'Unknown game',
    ...(game?.coverUrl ? { gameCoverUrl: game.coverUrl } : {}),
    memberIds: memberRows.map((member) => member.userId),
  }
}
