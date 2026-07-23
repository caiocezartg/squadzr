import { afterEach, describe, expect, it } from 'vitest'
import {
  createPostgresIntegrationHarness,
  type PostgresIntegrationHarness,
} from './postgres-harness'

const integrationDatabaseUrl = process.env['SQUADZR_TEST_DATABASE_URL']
const postgresIt = integrationDatabaseUrl ? it : it.skip

describe('Postgres integration harness', () => {
  let harness: PostgresIntegrationHarness | undefined

  afterEach(async () => {
    await harness?.close()
    harness = undefined
  })

  postgresIt('verifies a real PostgreSQL connection rather than a mock', async () => {
    harness = await createPostgresIntegrationHarness(integrationDatabaseUrl)

    await expect(harness.verify()).resolves.toMatchObject({ engine: 'postgresql' })
    await expect(harness.migrate()).resolves.toBeUndefined()
    await expect(harness.query<{ answer: number }>('SELECT 42 AS answer')).resolves.toMatchObject({
      rows: [{ answer: 42 }],
    })
    await expect(
      harness.query<{ table_name: string | null }>(
        "SELECT to_regclass('public.squads') AS table_name"
      )
    ).resolves.toMatchObject({ rows: [{ table_name: 'squads' }] })
    await expect(
      harness.query<{ function_name: string | null }>(
        "SELECT to_regprocedure('lock_recruiting_squad_membership_slot(uuid)') AS function_name"
      )
    ).resolves.toMatchObject({
      rows: [{ function_name: 'lock_recruiting_squad_membership_slot(uuid)' }],
    })
    await expect(
      harness.query<{ delete_rule: string }>(
        `SELECT rc.delete_rule
         FROM information_schema.referential_constraints rc
         WHERE rc.constraint_name IN (
           'squads_legacy_room_id_rooms_id_fk',
           'squad_memberships_legacy_room_id_rooms_id_fk'
         )`
      )
    ).resolves.toMatchObject({ rows: [{ delete_rule: 'SET NULL' }, { delete_rule: 'SET NULL' }] })
  })
})
