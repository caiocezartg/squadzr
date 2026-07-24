import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { inArray } from 'drizzle-orm'
import pg from 'pg'
import * as schema from '@infrastructure/database/schema'
import { DrizzleSquadLifecycle } from './drizzle-squad-lifecycle'
import { createPostgresIntegrationHarness } from '@test/integration/postgres-harness'

const integrationDatabaseUrl = process.env['SQUADZR_TEST_DATABASE_URL']
const postgresIt = integrationDatabaseUrl ? it : it.skip

describe('DrizzleSquadLifecycle public discovery', () => {
  postgresIt(
    'returns only public, operational Recruiting Squads with available Membership capacity',
    async () => {
      const harness = await createPostgresIntegrationHarness(integrationDatabaseUrl)
      await harness.migrate()
      await harness.close()

      const pool = new pg.Pool({ connectionString: integrationDatabaseUrl })
      const db = drizzle(pool, { schema })
      const gameId = randomUUID()
      const memberIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()]
      const squadIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()]
      const now = new Date()
      const future = new Date(now.getTime() + 60 * 60 * 1000)
      const past = new Date(now.getTime() - 60 * 1000)

      try {
        await db.insert(schema.games).values({
          id: gameId,
          name: 'Discovery test game',
          slug: `discovery-${gameId}`,
          coverUrl: 'https://example.com/cover.png',
        })
        await db.insert(schema.user).values(
          memberIds.map((id, index) => ({
            id,
            name: `Member ${index}`,
            email: `member-${id}@example.com`,
          }))
        )
        await db.insert(schema.squads).values([
          {
            id: squadIds[0]!,
            code: 'PUB001',
            name: 'Public Squad',
            gameId,
            state: 'recruiting',
            maxMembers: 3,
            discordInvitation: 'https://discord.gg/public',
            tags: ['ranked'],
            language: 'pt-br',
            lastMembershipChangeAt: now,
            expiresAt: future,
          },
          {
            id: squadIds[1]!,
            code: 'RDY001',
            name: 'Ready Squad',
            gameId,
            state: 'ready',
            maxMembers: 2,
            discordInvitation: 'https://discord.gg/ready',
            tags: [],
            language: 'en',
            lastMembershipChangeAt: now,
            readyAt: now,
            expiresAt: future,
          },
          {
            id: squadIds[2]!,
            code: 'EXP001',
            name: 'Expired Squad',
            gameId,
            state: 'recruiting',
            maxMembers: 2,
            discordInvitation: 'https://discord.gg/expired',
            tags: [],
            language: 'en',
            lastMembershipChangeAt: past,
            expiresAt: past,
          },
          {
            id: squadIds[3]!,
            code: 'FUL001',
            name: 'Full Squad',
            gameId,
            state: 'recruiting',
            maxMembers: 2,
            discordInvitation: 'https://discord.gg/full',
            tags: [],
            language: 'en',
            lastMembershipChangeAt: now,
            expiresAt: future,
          },
        ])
        await db.insert(schema.squadMemberships).values([
          {
            id: randomUUID(),
            squadId: squadIds[0]!,
            userId: memberIds[0]!,
            role: 'owner',
            joinedAt: now,
          },
          {
            id: randomUUID(),
            squadId: squadIds[1]!,
            userId: memberIds[1]!,
            role: 'owner',
            joinedAt: now,
          },
          {
            id: randomUUID(),
            squadId: squadIds[2]!,
            userId: memberIds[2]!,
            role: 'owner',
            joinedAt: now,
          },
          {
            id: randomUUID(),
            squadId: squadIds[3]!,
            userId: memberIds[3]!,
            role: 'owner',
            joinedAt: now,
          },
          {
            id: randomUUID(),
            squadId: squadIds[3]!,
            userId: memberIds[4]!,
            role: 'member',
            joinedAt: now,
          },
        ])

        const lifecycle = new DrizzleSquadLifecycle(db)
        const squads = await lifecycle.listRecruitingSquads()

        expect(squads).toHaveLength(1)
        expect(squads[0]).toMatchObject({
          id: squadIds[0],
          code: 'PUB001',
          name: 'Public Squad',
          gameId,
          memberCount: 1,
          maxMembers: 3,
          tags: ['ranked'],
          language: 'pt-br',
        })
        expect(squads[0]).not.toHaveProperty('ownerId')
        expect(squads[0]).not.toHaveProperty('roster')
        expect(squads[0]).not.toHaveProperty('online')
        expect(squads[0]).not.toHaveProperty('discordInvitation')
        await expect(lifecycle.getPublic('PUB001')).resolves.toMatchObject({ code: 'PUB001' })
        await expect(lifecycle.getPublic('RDY001')).resolves.toBeNull()
      } finally {
        await db
          .delete(schema.squadMemberships)
          .where(inArray(schema.squadMemberships.squadId, squadIds))
        await db.delete(schema.squads).where(inArray(schema.squads.id, squadIds))
        await db.delete(schema.games).where(inArray(schema.games.id, [gameId]))
        await db.delete(schema.user).where(inArray(schema.user.id, memberIds))
        await pool.end()
      }
    }
  )
})
