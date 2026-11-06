import { and, eq, inArray, ne } from 'drizzle-orm'
import type { NewAuditEntry } from '@domain/entities/audit-entry.entity'
import type { User } from '@domain/entities/user.entity'
import type { GrantRoleOutcome, IUserRepository } from '@domain/repositories/user.repository'
import type { Database } from '@infrastructure/database/drizzle'
import { account, user, type UserRow } from '@infrastructure/database/schema/auth'
import { insertAuditEntry } from './audit-entry-writer'

/** The provider id Better Auth stores on a Discord account row. */
const DISCORD_PROVIDER_ID = 'discord'

/** The unique index that allows a single owner. */
const SINGLE_OWNER_INDEX = 'user_single_owner_idx'

/** True when a Postgres error, or the error it is the cause of, is the single-owner index refusing a second owner. */
function isSecondOwnerViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as {
    code?: string
    constraint_name?: string
    constraint?: string
    cause?: unknown
  }
  const named = (candidate.constraint_name ?? candidate.constraint) === SINGLE_OWNER_INDEX
  return (candidate.code === '23505' && named) || isSecondOwnerViolation(candidate.cause)
}

function mapRowToEntity(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.image, // Better Auth uses 'image', domain uses 'avatarUrl'
    role: row.role,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class DrizzleUserRepository implements IUserRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<User | null> {
    const result = await this.db.select().from(user).where(eq(user.id, id)).limit(1)
    const row = result[0]
    return row ? mapRowToEntity(row) : null
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return []
    const result = await this.db.select().from(user).where(inArray(user.id, ids))
    return result.map(mapRowToEntity)
  }

  async findByIdOrDiscordId(identifier: string): Promise<User | null> {
    const byId = await this.findById(identifier)
    if (byId) return byId

    // The user table has no Discord column: a Discord id is the account id of the Discord account row.
    const [row] = await this.db
      .select({ person: user })
      .from(account)
      .innerJoin(user, eq(user.id, account.userId))
      .where(and(eq(account.providerId, DISCORD_PROVIDER_ID), eq(account.accountId, identifier)))
      .limit(1)
    return row ? mapRowToEntity(row.person) : null
  }

  async findOwner(): Promise<User | null> {
    const [row] = await this.db.select().from(user).where(eq(user.role, 'owner')).limit(1)
    return row ? mapRowToEntity(row) : null
  }

  async grantRole(
    userId: string,
    role: 'admin' | 'owner',
    audit: NewAuditEntry
  ): Promise<GrantRoleOutcome> {
    try {
      return await this.writeRole(userId, role, audit)
    } catch (error) {
      // Two runs granting the first owner at once both pass the owner check; the index refuses the loser.
      if (role === 'owner' && isSecondOwnerViolation(error)) return 'owner_taken'
      throw error
    }
  }

  private writeRole(
    userId: string,
    role: 'admin' | 'owner',
    audit: NewAuditEntry
  ): Promise<GrantRoleOutcome> {
    return this.db.transaction(async (tx) => {
      // The condition keeps it idempotent under a race (only the call that flips the role writes the
      // entry) and keeps `admin` from ever demoting the owner or an admin. A second owner is refused
      // by the unique index, not by this code.
      const grantable =
        role === 'owner' ? ne(user.role, 'owner') : inArray(user.role, ['user', 'moderator'])
      const changed = await tx
        .update(user)
        .set({ role, updatedAt: audit.createdAt })
        .where(and(eq(user.id, userId), grantable))
        .returning({ id: user.id })
      if (changed.length === 0) return 'unchanged'

      await insertAuditEntry(tx, audit)
      return 'granted'
    })
  }
}
