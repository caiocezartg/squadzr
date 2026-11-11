import { sql } from 'drizzle-orm'
import type { Database } from '@infrastructure/database/drizzle'
import type { IDatabaseHealth } from '@domain/services/database-health.interface'

export class DrizzleDatabaseHealth implements IDatabaseHealth {
  constructor(private readonly db: Database) {}

  async ping(): Promise<void> {
    await this.db.execute(sql`SELECT 1`)
  }
}
