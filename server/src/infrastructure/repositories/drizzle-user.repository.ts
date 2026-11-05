import { and, eq, inArray, ne } from 'drizzle-orm'
import type { NewAuditEntry } from '@domain/entities/audit-entry.entity'
import type { User } from '@domain/entities/user.entity'
import type { IUserRepository } from '@domain/repositories/user.repository'
import type { Database } from '@infrastructure/database/drizzle'
import { account, user, type UserRow } from '@infrastructure/database/schema/auth'
import { insertAuditEntry } from './audit-entry-writer'

/** The provider id Better Auth stores on a Discord account row. */
const DISCORD_PROVIDER_ID = 'discord'

function mapRowToEntity(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.image, // Better Auth uses 'image', domain uses 'avatarUrl'
    // A check constraint keeps the column to the known roles.
    role: row.role as User['role'],
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

  async grantAdmin(userId: string, audit: NewAuditEntry): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      // The condition keeps it idempotent under a race: only the call that flips the role writes the entry.
      const changed = await tx
        .update(user)
        .set({ role: 'admin', updatedAt: audit.createdAt })
        .where(and(eq(user.id, userId), ne(user.role, 'admin')))
        .returning({ id: user.id })
      if (changed.length === 0) return false

      await insertAuditEntry(tx, audit)
      return true
    })
  }
}
