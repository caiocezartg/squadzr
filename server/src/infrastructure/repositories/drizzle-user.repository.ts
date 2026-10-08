import { eq, inArray } from 'drizzle-orm'
import type { User } from '@domain/entities/user.entity'
import type { IUserRepository } from '@domain/repositories/user.repository'
import type { Database } from '@infrastructure/database/drizzle'
import { user, type UserRow } from '@infrastructure/database/schema/auth'

function mapRowToEntity(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.image, // Better Auth uses 'image', domain uses 'avatarUrl'
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
}
