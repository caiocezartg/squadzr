import { describe, expect, it, vi } from 'vitest'
import type { IAdminStatsRepository } from '@domain/repositories/admin-stats.repository'
import type { AuditEntry } from '@domain/entities/audit-entry.entity'
import type { IAuditEntryRepository } from '@domain/repositories/audit-entry.repository'
import type { OnlinePresence } from '@domain/services/online-presence.interface'
import { createMockClock } from '@test/mocks'
import { GetAdminActivityUseCase } from './get-admin-activity.use-case'
import { GetAdminOverviewUseCase } from './get-admin-overview.use-case'

// 2026-11-05 12:00 in Sao Paulo.
const NOW = new Date('2026-11-05T15:00:00.000Z')
const TIME_ZONE = 'America/Sao_Paulo'

function entry(id: string): AuditEntry {
  return {
    id,
    actorId: null,
    actorName: null,
    action: 'admin_granted',
    target: null,
    reason: null,
    details: null,
    createdAt: NOW,
  }
}

function setup(counts: Record<string, Record<string, number>> = {}, startsAt: Date = NOW) {
  const stats: IAdminStatsRepository = {
    countUsers: () => Promise.resolve(40),
    countOpenSquads: () => Promise.resolve(6),
    countCompletedSquads: () => Promise.resolve(25),
    countByDay: vi.fn((metric) => Promise.resolve(new Map(Object.entries(counts[metric] ?? {})))),
  }
  const list = vi.fn(() => Promise.resolve({ entries: [entry('a'), entry('b')], total: 2 }))
  const audit: IAuditEntryRepository = { list }
  const presence: OnlinePresence = { countOnlineUsers: () => 3, isUserOnline: () => false }
  const clock = createMockClock(startsAt)
  const activity = new GetAdminActivityUseCase(stats, clock, TIME_ZONE)

  return {
    stats,
    clock,
    list,
    activity,
    overview: new GetAdminOverviewUseCase(stats, audit, activity, presence, clock),
  }
}

describe('GetAdminActivityUseCase', () => {
  it('asks for the two periods in one range, in the panel zone', async () => {
    const { activity, stats } = setup()

    const result = await activity.execute({ metric: 'signups', period: 7 })

    expect(stats.countByDay).toHaveBeenCalledWith('signups', '2026-10-23', '2026-11-05', TIME_ZONE)
    expect(result.rows).toHaveLength(7)
    expect(result.rows[0]).toEqual({ date: '2026-10-30', current: 0, previous: 0 })
  })

  it('takes today from the clock in Sao Paulo, not in UTC', async () => {
    // 01:00 UTC on Nov 6 is still Nov 5 in Sao Paulo.
    const late = new GetAdminActivityUseCase(
      setup().stats,
      createMockClock(new Date('2026-11-06T01:00:00.000Z')),
      TIME_ZONE
    )

    expect((await late.execute({ metric: 'completed', period: 7 })).rows.at(-1)?.date).toBe(
      '2026-11-05'
    )
  })
})

describe('GetAdminOverviewUseCase', () => {
  const counts = {
    completed: { '2026-11-05': 2, '2026-11-04': 1, '2026-10-29': 4 },
    signups: { '2026-11-05': 1, '2026-10-23': 5 },
  }

  it('returns the live numbers and the sums of both periods', async () => {
    const { overview } = setup(counts)

    const result = await overview.execute({ period: 7, viewerRole: 'admin' })

    expect(result.live).toEqual({
      onlineUsers: 3,
      totalUsers: 40,
      openSquads: 6,
      completedSquads: 25,
    })
    expect(result.metrics).toEqual({
      completed: { current: 3, previous: 4 },
      signups: { current: 1, previous: 5 },
    })
  })

  it('reads the clock once, so a day rolling over mid-request cannot split the series', async () => {
    // 23:59:59 in Sao Paulo on Nov 5: the next read would already be Nov 6.
    const { overview, stats, clock } = setup({}, new Date('2026-11-06T02:59:59.000Z'))
    vi.mocked(stats.countByDay).mockImplementation(() => {
      clock.set(new Date('2026-11-06T03:00:01.000Z'))
      return Promise.resolve(new Map())
    })

    await overview.execute({ period: 7, viewerRole: 'admin' })

    expect(clock.now).toHaveBeenCalledTimes(1)
    const ranges = vi.mocked(stats.countByDay).mock.calls.map(([, from, to]) => [from, to])
    expect(ranges).toEqual([
      ['2026-10-23', '2026-11-05'],
      ['2026-10-23', '2026-11-05'],
    ])
  })

  it('shows the latest 5 audit entries to an admin and the owner only', async () => {
    const { overview, list } = setup()

    expect((await overview.execute({ period: 7, viewerRole: 'owner' })).recentAudit).toHaveLength(2)
    expect(list).toHaveBeenCalledWith(0, 5)

    list.mockClear()
    for (const viewerRole of ['moderator', 'user', undefined]) {
      expect((await overview.execute({ period: 7, viewerRole })).recentAudit).toBeNull()
    }
    expect(list).not.toHaveBeenCalled()
  })
})
