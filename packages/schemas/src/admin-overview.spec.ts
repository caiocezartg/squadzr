import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OVERVIEW_PERIOD,
  activityQuerySchema,
  activityResponseSchema,
  overviewQuerySchema,
  overviewResponseSchema,
} from './index'

const auditEntry = {
  id: 'entry-1',
  action: 'admin_granted',
  actorId: null,
  actorName: null,
  target: { type: 'user', id: 'user-1', name: 'Marina' },
  reason: null,
  details: { oldRole: 'user', newRole: 'admin' },
  createdAt: '2026-11-05T12:00:00.000Z',
}

const overview = {
  period: 30,
  live: { onlineUsers: 3, totalUsers: 120, openSquads: 8, completedSquads: 45 },
  metrics: {
    completed: { current: 12, previous: 9 },
    signups: { current: 20, previous: 0 },
    online: { current: 14, previous: null },
    open: { current: null, previous: null },
  },
  recentAudit: [auditEntry],
}

describe('overview query', () => {
  it.each([7, 30, 90])('accepts the period %i as text', (period) => {
    expect(overviewQuerySchema.parse({ period: String(period) })).toEqual({ period })
  })

  it('defaults to 30 days', () => {
    expect(overviewQuerySchema.parse({})).toEqual({ period: DEFAULT_OVERVIEW_PERIOD })
  })

  it.each(['0', '14', '365', 'abc', ''])('rejects the period "%s"', (period) => {
    expect(overviewQuerySchema.safeParse({ period }).success).toBe(false)
  })
})

describe('activity query', () => {
  it('needs a known metric and defaults the period', () => {
    expect(activityQuerySchema.parse({ metric: 'signups' })).toEqual({
      metric: 'signups',
      period: DEFAULT_OVERVIEW_PERIOD,
    })
    expect(activityQuerySchema.safeParse({}).success).toBe(false)
    expect(activityQuerySchema.parse({ metric: 'online' }).metric).toBe('online')
    expect(activityQuerySchema.parse({ metric: 'open' }).metric).toBe('open')
    expect(activityQuerySchema.safeParse({ metric: 'peak' }).success).toBe(false)
  })
})

describe('overview response', () => {
  it('carries the live numbers, both periods and the recent audit', () => {
    expect(overviewResponseSchema.parse(overview)).toEqual(overview)
  })

  it('allows no recent audit for a moderator', () => {
    expect(overviewResponseSchema.safeParse({ ...overview, recentAudit: null }).success).toBe(true)
  })

  it('allows a peak that is null for a period without Activity Samples', () => {
    const noPeaks = { current: null, previous: null }

    expect(
      overviewResponseSchema.safeParse({
        ...overview,
        metrics: { ...overview.metrics, online: noPeaks, open: noPeaks },
      }).success
    ).toBe(true)
  })

  it('rejects a negative count and an unknown period', () => {
    expect(
      overviewResponseSchema.safeParse({ ...overview, live: { ...overview.live, onlineUsers: -1 } })
        .success
    ).toBe(false)
    expect(overviewResponseSchema.safeParse({ ...overview, period: 14 }).success).toBe(false)
  })
})

describe('activity response', () => {
  it('accepts counted days and days without data', () => {
    const response = {
      metric: 'completed',
      period: 7,
      rows: [
        { date: '2026-11-04', current: 2, previous: null },
        { date: '2026-11-05', current: null, previous: 0 },
      ],
    }

    expect(activityResponseSchema.parse(response)).toEqual(response)
  })

  it('rejects a date that is not a calendar day', () => {
    expect(
      activityResponseSchema.safeParse({
        metric: 'completed',
        period: 7,
        rows: [{ date: '2026-11-05T00:00:00Z', current: 1, previous: 1 }],
      }).success
    ).toBe(false)
  })
})
