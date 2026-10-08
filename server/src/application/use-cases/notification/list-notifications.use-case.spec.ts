import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ListNotificationsUseCase } from './list-notifications.use-case'
import type { UserNotification } from '@domain/entities/user-notification.entity'
import type { IUserNotificationRepository } from '@domain/repositories/user-notification.repository'
import { createMockClock, createMockRoom, createMockRoomRepository } from '@test/mocks'
import { ROOM } from '@config/constants'

const READY_AT = new Date('2026-01-01T00:00:00.000Z')

function createNotification(overrides: Partial<UserNotification> = {}): UserNotification {
  return {
    id: 'notification-1',
    userId: 'user-1',
    roomId: 'room-1',
    type: 'room_ready',
    title: 'Room ready: your squad is full',
    message: 'ready',
    payload: {
      roomId: 'room-1',
      roomCode: 'ABC123',
      roomName: 'Ranked squad',
      gameName: 'League of Legends',
      players: [{ name: 'Host', image: null }],
    },
    readAt: null,
    createdAt: READY_AT,
    ...overrides,
  }
}

function createMockNotificationRepository() {
  return {
    findByUserId: vi.fn<(userId: string, limit?: number) => Promise<UserNotification[]>>(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    delete: vi.fn(),
  } as unknown as IUserNotificationRepository & {
    findByUserId: ReturnType<typeof vi.fn>
  }
}

describe('ListNotificationsUseCase', () => {
  let useCase: ListNotificationsUseCase
  let notificationRepository: ReturnType<typeof createMockNotificationRepository>
  let roomRepository: ReturnType<typeof createMockRoomRepository>
  let clock: ReturnType<typeof createMockClock>

  beforeEach(() => {
    notificationRepository = createMockNotificationRepository()
    roomRepository = createMockRoomRepository()
    clock = createMockClock(READY_AT)
    useCase = new ListNotificationsUseCase(notificationRepository, roomRepository, clock)
  })

  it('resolves the invite through the retained room at read time', async () => {
    notificationRepository.findByUserId.mockResolvedValue([createNotification()])
    roomRepository.findByIds.mockResolvedValue([
      createMockRoom({
        id: 'room-1',
        discordLink: 'https://discord.gg/squadzr',
        readyAt: READY_AT,
        lastActivityAt: READY_AT,
      }),
    ])

    const result = await useCase.execute({ userId: 'user-1', limit: 10 })

    expect(notificationRepository.findByUserId).toHaveBeenCalledWith('user-1', 10)
    expect(roomRepository.findByIds).toHaveBeenCalledWith(['room-1'])
    expect(result.notifications).toEqual([
      {
        notification: expect.objectContaining({ id: 'notification-1' }),
        discordLink: 'https://discord.gg/squadzr',
      },
    ])
  })

  it('hides the invite once the room retention has passed, keeping the notification', async () => {
    notificationRepository.findByUserId.mockResolvedValue([createNotification()])
    roomRepository.findByIds.mockResolvedValue([
      createMockRoom({
        id: 'room-1',
        discordLink: 'https://discord.gg/squadzr',
        readyAt: READY_AT,
        lastActivityAt: READY_AT,
      }),
    ])
    clock.set(new Date(READY_AT.getTime() + ROOM.READY_ROOM_RETENTION_MS))

    const result = await useCase.execute({ userId: 'user-1', limit: 10 })

    expect(result.notifications).toHaveLength(1)
    expect(result.notifications[0]?.discordLink).toBeNull()
  })

  it('hides the invite when the room row is already gone', async () => {
    notificationRepository.findByUserId.mockResolvedValue([createNotification()])
    roomRepository.findByIds.mockResolvedValue([])

    const result = await useCase.execute({ userId: 'user-1', limit: 10 })

    expect(result.notifications[0]?.discordLink).toBeNull()
  })

  it('never queries rooms for notifications without a room id', async () => {
    notificationRepository.findByUserId.mockResolvedValue([
      createNotification({ roomId: null, payload: { ...createNotification().payload } }),
    ])

    const result = await useCase.execute({ userId: 'user-1', limit: 10 })

    expect(roomRepository.findByIds).toHaveBeenCalledWith([])
    expect(result.notifications[0]?.discordLink).toBeNull()
  })
})
