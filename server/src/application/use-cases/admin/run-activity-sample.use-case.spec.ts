import { describe, expect, it, vi } from 'vitest'
import type { IActivitySampleRepository } from '@domain/repositories/activity-sample.repository'
import type { IAdminStatsRepository } from '@domain/repositories/admin-stats.repository'
import type { OnlinePresence } from '@domain/services/online-presence.interface'
import { createMockClock } from '@test/mocks'
import { RunActivitySampleUseCase } from './run-activity-sample.use-case'

const NOW = new Date('2026-11-05T15:00:00.000Z')

function setup() {
  const record = vi.fn(() => Promise.resolve())
  const samples: IActivitySampleRepository = { record, peakByDay: vi.fn() }
  const countOpenSquads = vi.fn(() => Promise.resolve(6))
  const stats = { countOpenSquads } as unknown as IAdminStatsRepository
  const presence: OnlinePresence = { countOnlineUsers: () => 3, isUserOnline: () => false }

  return {
    record,
    countOpenSquads,
    useCase: new RunActivitySampleUseCase(presence, stats, samples, createMockClock(NOW)),
  }
}

describe('RunActivitySampleUseCase', () => {
  it('stores one sample with the clock instant and the current online and Open Squads counts', async () => {
    const { useCase, record, countOpenSquads } = setup()

    await useCase.execute()

    expect(countOpenSquads).toHaveBeenCalledWith(NOW)
    expect(record).toHaveBeenCalledTimes(1)
    expect(record).toHaveBeenCalledWith({ sampledAt: NOW, onlineUsers: 3, openSquads: 6 })
  })
})
