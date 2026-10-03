import type { FastifyBaseLogger } from 'fastify'
import { describe, expect, it, vi } from 'vitest'
import { runRoomCleanup } from './room-cleanup.plugin'
import type { IDeleteExpiredRoomsUseCase } from '@application/use-cases/room/delete-expired-rooms.use-case'
import type { IRoomBroadcaster } from '@domain/services/room-broadcaster.interface'

function createLog() {
  return {
    info: vi.fn(),
    error: vi.fn(),
  } as unknown as FastifyBaseLogger
}

function createBroadcaster() {
  return {
    broadcastRoomDeleted: vi.fn(),
  } as unknown as IRoomBroadcaster
}

describe('runRoomCleanup', () => {
  it('logs and broadcasts each expired room after deletion', async () => {
    const log = createLog()
    const broadcaster = createBroadcaster()
    const useCase = {
      execute: vi.fn().mockResolvedValue({
        deletedRooms: [{ id: 'room-1', code: 'ABC123', reason: 'ready_expired' }],
      }),
    } as unknown as IDeleteExpiredRoomsUseCase

    await runRoomCleanup(log, useCase, broadcaster)

    expect(broadcaster.broadcastRoomDeleted).toHaveBeenCalledWith('room-1', 'ABC123')
    expect(log.info).toHaveBeenCalledWith(
      { roomId: 'room-1', roomCode: 'ABC123', reason: 'ready_expired' },
      'Room expired'
    )
    expect(log.info).toHaveBeenCalledWith({ roomId: 'room-1', roomCode: 'ABC123' }, 'Room deleted')
  })

  it('swallows a scheduler failure and logs it instead of rejecting', async () => {
    const log = createLog()
    const broadcaster = createBroadcaster()
    const failure = new Error('database unavailable')
    const useCase = {
      execute: vi.fn().mockRejectedValue(failure),
    } as unknown as IDeleteExpiredRoomsUseCase

    await expect(runRoomCleanup(log, useCase, broadcaster)).resolves.toBeUndefined()

    expect(log.error).toHaveBeenCalledWith({ err: failure }, 'Room cleanup failed')
    expect(broadcaster.broadcastRoomDeleted).not.toHaveBeenCalled()
  })

  it('keeps cleaning when a deletion broadcast fails', async () => {
    const log = createLog()
    const failure = new Error('socket down')
    const broadcaster = {
      broadcastRoomDeleted: vi.fn().mockImplementation(() => {
        throw failure
      }),
    } as unknown as IRoomBroadcaster
    const useCase = {
      execute: vi.fn().mockResolvedValue({
        deletedRooms: [{ id: 'room-1', code: 'ABC123', reason: 'open_expired' }],
      }),
    } as unknown as IDeleteExpiredRoomsUseCase

    await expect(runRoomCleanup(log, useCase, broadcaster)).resolves.toBeUndefined()

    expect(log.error).toHaveBeenCalledWith(
      { err: failure, roomId: 'room-1', roomCode: 'ABC123' },
      'Room deletion broadcast failed'
    )
    expect(log.info).toHaveBeenCalledWith({ roomId: 'room-1', roomCode: 'ABC123' }, 'Room deleted')
  })
})
