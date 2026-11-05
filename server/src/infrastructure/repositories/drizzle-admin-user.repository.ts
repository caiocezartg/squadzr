import { and, asc, count, desc, eq, exists, ilike, inArray, or, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type {
  AdminUser,
  AdminUserCompletedSquad,
  AdminUserListItem,
  AdminUserOpenSquad,
} from '@domain/entities/admin-user.entity'
import type {
  AdminUserPage,
  ChangeRoleCommand,
  IAdminUserRepository,
  RoleChangeOutcome,
} from '@domain/repositories/admin-user.repository'
import { decideRoleChange } from '@domain/services/role-change'
import type { Database } from '@infrastructure/database/drizzle'
import { user, type UserRow } from '@infrastructure/database/schema/auth'
import { games } from '@infrastructure/database/schema/games'
import { roomMembers } from '@infrastructure/database/schema/room-members'
import { rooms } from '@infrastructure/database/schema/rooms'
import { squadRecordMembers, squadRecords } from '@infrastructure/database/schema/squad-records'
import { insertAuditEntry } from './audit-entry-writer'
import { validOpenRoomCondition } from './open-room-rules'
import { profileGameColumns } from './drizzle-squad-record.repository'

/** The provider id Better Auth stores on a Discord account row. */
const DISCORD_PROVIDER_ID = 'discord'

// The correlated pieces below spell their columns out: drizzle leaves a column of a single-table query
// unqualified, which inside a subquery would resolve to the subquery's own table.

/** The user's Discord id: the account id of their Discord account row. */
const discordIdColumn = sql<string | null>`(
  select "account"."account_id" from "account"
  where "account"."user_id" = "user"."id" and "account"."provider_id" = ${DISCORD_PROVIDER_ID}
  limit 1
)`

/** The admin panel's view of a user row: no email, and the Discord id the account holds. */
const adminUserColumns = {
  id: user.id,
  name: user.name,
  image: user.image,
  role: user.role,
  createdAt: user.createdAt,
  discordId: discordIdColumn,
} as const

type AdminUserRow = Pick<UserRow, 'id' | 'name' | 'image' | 'role' | 'createdAt'> & {
  discordId: string | null
}

function mapRowToAdminUser(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.image,
    discordId: row.discordId,
    role: row.role,
    createdAt: row.createdAt,
  }
}

/** Takes the LIKE wildcards and the escape character literally, so a name is matched as typed. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`)
}

/** A name by any part of it, or a user id or a Discord id exactly. */
function searchCondition(term: string): SQL | undefined {
  return or(
    ilike(user.name, `%${escapeLike(term)}%`),
    eq(user.id, term),
    exists(
      sql`(select 1 from "account"
        where "account"."user_id" = "user"."id"
          and "account"."provider_id" = ${DISCORD_PROVIDER_ID}
          and "account"."account_id" = ${term})`
    )
  )
}

export class DrizzleAdminUserRepository implements IAdminUserRepository {
  constructor(private readonly db: Database) {}

  async list(
    search: string | undefined,
    offset: number,
    limit: number,
    now: Date
  ): Promise<AdminUserPage> {
    const where = search ? searchCondition(search) : undefined
    const openSquads = this.db
      .select({ held: count() })
      .from(roomMembers)
      .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
      .where(and(eq(roomMembers.userId, user.id), validOpenRoomCondition(now)))

    const [rows, totals] = await Promise.all([
      this.db
        .select({
          ...adminUserColumns,
          openSquads: sql<number>`(${openSquads})::int`,
        })
        .from(user)
        .where(where)
        .orderBy(desc(user.createdAt), desc(user.id))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(user).where(where),
    ])

    const items: AdminUserListItem[] = rows.map((row) => ({
      ...mapRowToAdminUser(row),
      openSquads: row.openSquads,
    }))
    return { items, total: totals[0]?.total ?? 0 }
  }

  async findById(id: string): Promise<AdminUser | null> {
    const [row] = await this.db.select(adminUserColumns).from(user).where(eq(user.id, id)).limit(1)
    return row ? mapRowToAdminUser(row) : null
  }

  async findOpenSquads(userId: string, now: Date): Promise<AdminUserOpenSquad[]> {
    const members = alias(roomMembers, 'squad_members')
    const memberCount = this.db
      .select({ total: count() })
      .from(members)
      .where(eq(members.roomId, rooms.id))

    const rows = await this.db
      .select({
        id: rooms.id,
        code: rooms.code,
        name: rooms.name,
        hostId: rooms.hostId,
        maxPlayers: rooms.maxPlayers,
        game: profileGameColumns,
        memberCount: sql<number>`(${memberCount})::int`,
      })
      .from(roomMembers)
      .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
      .innerJoin(games, eq(games.id, rooms.gameId))
      .where(and(eq(roomMembers.userId, userId), validOpenRoomCondition(now)))
      .orderBy(desc(rooms.createdAt), desc(rooms.id))

    return rows.map(({ hostId, ...squad }) => ({ ...squad, isHost: hostId === userId }))
  }

  async findLatestCompleted(userId: string, limit: number): Promise<AdminUserCompletedSquad[]> {
    return this.db
      .select({
        id: squadRecords.id,
        name: squadRecords.name,
        maxPlayers: squadRecords.maxPlayers,
        readyAt: squadRecords.readyAt,
        game: profileGameColumns,
      })
      .from(squadRecordMembers)
      .innerJoin(squadRecords, eq(squadRecords.id, squadRecordMembers.recordId))
      .innerJoin(games, eq(games.id, squadRecords.gameId))
      .where(eq(squadRecordMembers.userId, userId))
      .orderBy(desc(squadRecords.readyAt), desc(squadRecords.id))
      .limit(limit)
  }

  async changeRole(command: ChangeRoleCommand): Promise<RoleChangeOutcome> {
    return this.db.transaction(async (tx) => {
      // Every admin row, plus the actor's and the target's, locked in one ordered statement. Two admins
      // demoting each other queue on the same rows in the same order; the one that waits re-reads the
      // other's committed change, so it sees the actor it acts for is no longer an admin.
      const locked = await tx
        .select({ id: user.id, name: user.name, role: user.role })
        .from(user)
        .where(or(eq(user.role, 'admin'), inArray(user.id, [command.actorId, command.targetId])))
        .orderBy(asc(user.id))
        .for('no key update')

      const actor = locked.find((row) => row.id === command.actorId)
      const target = locked.find((row) => row.id === command.targetId)
      const decision = decideRoleChange({
        actorId: command.actorId,
        actorRole: actor?.role ?? null,
        targetId: command.targetId,
        targetRole: target?.role ?? null,
        newRole: command.role,
        adminCount: locked.filter((row) => row.role === 'admin').length,
      })

      if (decision === 'unchanged') return { status: 'unchanged' }
      if (decision !== 'change') return { status: 'refused', reason: decision }
      // A change implies both rows were read; this only narrows their types.
      if (!actor || !target) return { status: 'refused', reason: 'user_not_found' }

      await tx
        .update(user)
        .set({ role: command.role, updatedAt: command.now })
        .where(eq(user.id, target.id))
      await insertAuditEntry(tx, {
        actorId: actor.id,
        actorName: actor.name,
        action: 'role_changed',
        target: { type: 'user', id: target.id, name: target.name },
        reason: null,
        details: { oldRole: target.role, newRole: command.role },
        createdAt: command.now,
      })
      return { status: 'changed' }
    })
  }
}
