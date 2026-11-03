import { and, gt, inArray } from 'drizzle-orm'
import type { Database } from '@infrastructure/database/drizzle'
import { session } from '@infrastructure/database/schema'
import type { ActiveSessions } from '@domain/services/active-sessions.interface'
import type { Clock } from '@domain/services/clock.interface'

export class DrizzleActiveSessions implements ActiveSessions {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock
  ) {}

  async findActive(sessionIds: readonly string[]): Promise<ReadonlySet<string>> {
    if (sessionIds.length === 0) return new Set()

    const rows = await this.db
      .select({ id: session.id })
      .from(session)
      .where(and(inArray(session.id, [...sessionIds]), gt(session.expiresAt, this.clock.now())))
    return new Set(rows.map((row) => row.id))
  }
}
