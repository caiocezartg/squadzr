import { beforeEach, describe, expect, it } from 'vitest'
import { ADMIN_USER_LATEST_COMPLETED_LIMIT } from '@squadzr/schemas'
import { UserNotFoundError } from '@application/errors'
import type { AdminUserOpenSquad } from '@domain/entities/admin-user.entity'
import type { OnlinePresence } from '@domain/services/online-presence.interface'
import {
  createMockAdminUser,
  createMockAdminUserRepository,
  createMockClock,
  createMockPlayerStats,
  createMockSquadRecordRepository,
  type MockAdminUserRepository,
  type MockSquadRecordRepository,
} from '@test/mocks'
import { GetAdminUserUseCase } from './get-admin-user.use-case'

const NOW = new Date('2026-11-05T12:00:00.000Z')

const game = {
  id: 'game-1',
  name: 'Valorant',
  slug: 'valorant',
  coverUrl: 'https://cdn.squadzr.test/valorant.webp',
  thumbnailUrl: 'https://cdn.squadzr.test/valorant-thumb.webp',
}

function openSquad(id: string, isHost: boolean): AdminUserOpenSquad {
  return { id, code: id.toUpperCase(), name: id, game, memberCount: 2, maxPlayers: 5, isHost }
}

function presence(onlineIds: string[]): OnlinePresence {
  return {
    countOnlineUsers: () => onlineIds.length,
    isUserOnline: (userId) => onlineIds.includes(userId),
  }
}

describe('GetAdminUserUseCase', () => {
  let users: MockAdminUserRepository
  let records: MockSquadRecordRepository

  function build(onlineIds: string[] = []): GetAdminUserUseCase {
    return new GetAdminUserUseCase(users, records, presence(onlineIds), createMockClock(NOW))
  }

  beforeEach(() => {
    users = createMockAdminUserRepository()
    records = createMockSquadRecordRepository()
    users.findById.mockResolvedValue(createMockAdminUser({ id: 'user-1' }))
  })

  it('answers unknown user for an id nobody has', async () => {
    users.findById.mockResolvedValue(null)

    await expect(build().execute({ id: 'ghost' })).rejects.toBeInstanceOf(UserNotFoundError)
  })

  it('counts the Squad Limits over the Open Squads it lists: 2 held, 1 hosted', async () => {
    users.findOpenSquads.mockResolvedValue([openSquad('vlr', false), openSquad('lol', true)])

    const result = await build().execute({ id: 'user-1' })

    expect(users.findOpenSquads).toHaveBeenCalledWith('user-1', NOW)
    expect(result.squadLimits).toEqual({
      held: { used: 2, limit: 3 },
      hosted: { used: 1, limit: 1 },
    })
    expect(result.openSquads.map((squad) => squad.isHost)).toEqual([false, true])
  })

  it('reads the online state from the presence seam', async () => {
    expect((await build(['user-1']).execute({ id: 'user-1' })).online).toBe(true)
    expect((await build(['someone-else']).execute({ id: 'user-1' })).online).toBe(false)
  })

  it('adds the completed Squads count, the Games count and the latest five', async () => {
    records.getPlayerStats.mockResolvedValue(
      createMockPlayerStats({ completedSquads: 47, gamesPlayed: 6 })
    )

    const result = await build().execute({ id: 'user-1' })

    expect(records.getPlayerStats).toHaveBeenCalledWith('user-1', 0)
    expect(users.findLatestCompleted).toHaveBeenCalledWith(
      'user-1',
      ADMIN_USER_LATEST_COMPLETED_LIMIT
    )
    expect(result).toMatchObject({ completedSquads: 47, gamesPlayed: 6, latestCompleted: [] })
  })
})
