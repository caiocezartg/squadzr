import { z } from 'zod'

/**
 * What marks a row as the load test's. Every throwaway player gets an email on this reserved,
 * never-deliverable domain, with the run's tag in the local part, so a query finds exactly the rows of
 * one run (or of all runs) and nothing a real person owns.
 */
export const LOAD_TEST_EMAIL_DOMAIN = 'loadtest.squadzr.test'

/** A run's tag: lowercase letters and digits only, so it can sit in a LIKE pattern unescaped. */
export const tagSchema = z
  .string()
  .regex(/^[a-z0-9]{4,12}$/, 'tag must be 4 to 12 lowercase letters or digits')

export type Tag = z.infer<typeof tagSchema>

export function playerEmail(tag: Tag, index: number): string {
  return `lt-${tag}-${index}@${LOAD_TEST_EMAIL_DOMAIN}`
}

/** The LIKE pattern of one run's players, or of every run's when no tag is given. */
export function playerEmailPattern(tag?: Tag): string {
  return `lt-${tag ?? '%'}-%@${LOAD_TEST_EMAIL_DOMAIN}`
}

export interface PlanStatement {
  readonly name: string
  readonly text: string
  readonly values: readonly string[]
}

const TAGGED_USERS = `SELECT id FROM "user" WHERE email LIKE $1`

/**
 * The deletes that remove a run, in the order they must run. Squad Records come first: their host
 * reference is set to null when the player goes, after which nothing would link a record to the run. The
 * players' deletion then cascades to their sessions, accounts, Squads, Memberships and notifications.
 * `audit_entries` is append-only and is never part of the plan.
 */
export function cleanupPlan(tag?: Tag): readonly PlanStatement[] {
  const values = [playerEmailPattern(tag)]
  return [
    {
      name: 'squad_records',
      text: `DELETE FROM squad_records WHERE host_id IN (${TAGGED_USERS}) OR id IN (SELECT record_id FROM squad_record_members WHERE user_id IN (${TAGGED_USERS}))`,
      values,
    },
    { name: 'users', text: `DELETE FROM "user" WHERE email LIKE $1`, values },
  ]
}

/** One count per kind of row a run can leave behind; all zero means the run is gone. */
export function verifyPlan(tag?: Tag): readonly PlanStatement[] {
  const values = [playerEmailPattern(tag)]
  const count = (name: string, from: string): PlanStatement => ({
    name,
    text: `SELECT count(*)::int AS count FROM ${from}`,
    values,
  })
  return [
    count('users', `"user" WHERE email LIKE $1`),
    count('sessions', `session WHERE user_id IN (${TAGGED_USERS})`),
    count('squads', `rooms WHERE host_id IN (${TAGGED_USERS})`),
    count('squad_members', `room_members WHERE user_id IN (${TAGGED_USERS})`),
    count(
      'squad_records',
      `squad_records WHERE host_id IN (${TAGGED_USERS}) OR id IN (SELECT record_id FROM squad_record_members WHERE user_id IN (${TAGGED_USERS}))`
    ),
    count('squad_record_members', `squad_record_members WHERE user_id IN (${TAGGED_USERS})`),
    count('notifications', `user_notifications WHERE user_id IN (${TAGGED_USERS})`),
  ]
}

export const verifyCountsSchema = z.record(z.string(), z.number().int().min(0))

export type VerifyCounts = z.infer<typeof verifyCountsSchema>

/** True when every count is zero: nothing the run created remains. */
export function isClean(counts: VerifyCounts): boolean {
  return Object.values(counts).every((count) => count === 0)
}
