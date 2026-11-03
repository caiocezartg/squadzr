import { and, gt, inArray } from 'drizzle-orm'
import type { Database } from '@infrastructure/database/drizzle'
import { session } from '@infrastructure/database/schema'
import type { ActiveSessions } from '@domain/services/active-sessions.interface'
import type { Clock } from '@domain/services/clock.interface'

/** Ids per query, well under PostgreSQL's 65 535 bind parameters however many sockets are open. */
const IDS_PER_QUERY = 1_000

export class DrizzleActiveSessions implements ActiveSessions {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock
  ) {}

  async findActive(sessionIds: readonly string[]): Promise<ReadonlySet<string>> {
    const active = new Set<string>()
    const now = this.clock.now()
    for (let start = 0; start < sessionIds.length; start += IDS_PER_QUERY) {
      const ids = sessionIds.slice(start, start + IDS_PER_QUERY)
      const rows = await this.db
        .select({ id: session.id })
        .from(session)
        .where(and(inArray(session.id, ids), gt(session.expiresAt, now)))
      for (const row of rows) active.add(row.id)
    }
    return active
  }
}
