import { describe, expect, it } from 'vitest'
import {
  LOAD_TEST_EMAIL_DOMAIN,
  cleanupPlan,
  isClean,
  playerEmail,
  playerEmailPattern,
  tagSchema,
  verifyPlan,
} from './cleanup-plan'

describe('player marking', () => {
  it('puts the tag and the reserved domain on every player email', () => {
    expect(playerEmail('abc123', 7)).toBe(`lt-abc123-7@${LOAD_TEST_EMAIL_DOMAIN}`)
  })

  it('selects one run by its tag and every run without one', () => {
    expect(playerEmailPattern('abc123')).toBe(`lt-abc123-%@${LOAD_TEST_EMAIL_DOMAIN}`)
    expect(playerEmailPattern()).toBe(`lt-%-%@${LOAD_TEST_EMAIL_DOMAIN}`)
  })

  it('accepts only tags that cannot widen a LIKE pattern', () => {
    expect(tagSchema.safeParse('a1b2c3d4').success).toBe(true)
    for (const bad of ['', 'abc', 'ABCDEF', 'ab_cdef', 'ab%cdef', 'a'.repeat(13), 'ab cdef']) {
      expect(tagSchema.safeParse(bad).success).toBe(false)
    }
  })
})

describe('cleanupPlan', () => {
  it('deletes the Squad Records before the players, whose deletion would orphan them', () => {
    const names = cleanupPlan('abc123').map((statement) => statement.name)

    expect(names).toEqual(['squad_records', 'users'])
  })

  it('selects only the run through the tag pattern, as a bound parameter', () => {
    for (const statement of cleanupPlan('abc123')) {
      expect(statement.values).toEqual([`lt-abc123-%@${LOAD_TEST_EMAIL_DOMAIN}`])
      expect(statement.text).toContain('$1')
      expect(statement.text).not.toContain('abc123')
    }
  })

  it('only ever deletes from the run-owned tables, never from audit_entries', () => {
    for (const statement of [...cleanupPlan('abc123'), ...cleanupPlan()]) {
      expect(statement.text).toMatch(/^DELETE FROM (squad_records|"user") /)
      expect(statement.text).not.toContain('audit_entries')
    }
  })
})

describe('verifyPlan', () => {
  it('counts players, sessions, Squads, Squad Records and their members', () => {
    expect(verifyPlan('abc123').map((statement) => statement.name)).toEqual([
      'users',
      'sessions',
      'squads',
      'squad_members',
      'squad_records',
      'squad_record_members',
      'notifications',
    ])
  })

  it('reads only', () => {
    for (const statement of verifyPlan('abc123')) {
      expect(statement.text).toMatch(/^SELECT count\(\*\)/)
    }
  })
})

describe('isClean', () => {
  it('is true only when every count is zero', () => {
    expect(isClean({ users: 0, squads: 0 })).toBe(true)
    expect(isClean({ users: 0, squads: 1 })).toBe(false)
  })
})
