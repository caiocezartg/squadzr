import { and, desc, eq, gt, isNull, lt, sql } from 'drizzle-orm'
import type { PublicRecruitingSquad, SquadLanguage } from '@squadzr/types'
import type { SquadLifecycle } from '@domain/squad-lifecycle'
import type { Database } from '@infrastructure/database/drizzle'
import { squadMemberships, squads } from '@infrastructure/database/schema'
import { SystemClock } from './system-dependencies'

type PublicSquadLifecycle = Pick<SquadLifecycle, 'listRecruitingSquads' | 'getPublic'>

/**
 * The public read-model portion of Squad Lifecycle. Its selected columns are
 * intentionally limited to the public contract, so private data cannot cross
 * the HTTP boundary by a later object spread.
 */
export class DrizzleSquadLifecycle implements PublicSquadLifecycle {
  constructor(
    private readonly db: Database,
    private readonly clock = new SystemClock()
  ) {}

  async listRecruitingSquads(): Promise<ReadonlyArray<PublicRecruitingSquad>> {
    return this.findPublicRecruitingSquads()
  }

  async getPublic(code: string): Promise<PublicRecruitingSquad | null> {
    const [squad] = await this.findPublicRecruitingSquads(eq(squads.code, code))
    return squad ?? null
  }

  private async findPublicRecruitingSquads(codeCondition?: ReturnType<typeof eq>) {
    const memberCount = sql<number>`count(${squadMemberships.id})::int`
    const conditions = [
      eq(squads.state, 'recruiting'),
      isNull(squads.endedAt),
      gt(squads.expiresAt, this.clock.now()),
    ]

    if (codeCondition) {
      conditions.push(codeCondition)
    }

    const records = await this.db
      .select({
        id: squads.id,
        code: squads.code,
        name: squads.name,
        gameId: squads.gameId,
        maxMembers: squads.maxMembers,
        memberCount,
        tags: squads.tags,
        language: squads.language,
        expiresAt: squads.expiresAt,
        createdAt: squads.createdAt,
        updatedAt: squads.updatedAt,
      })
      .from(squads)
      .leftJoin(
        squadMemberships,
        and(eq(squadMemberships.squadId, squads.id), isNull(squadMemberships.endedAt))
      )
      .where(and(...conditions))
      .groupBy(squads.id)
      .having(lt(memberCount, squads.maxMembers))
      .orderBy(desc(squads.createdAt))

    return records.map((record) => ({
      ...record,
      language: record.language as SquadLanguage,
    }))
  }
}
