import { describe, expect, it, vi } from 'vitest'
import type { PublicRecruitingSquad } from '@squadzr/types'
import { SquadController } from './squad.controller'

const publicSquad: PublicRecruitingSquad = {
  id: '00000000-0000-4000-8000-000000000001',
  code: 'PUB001',
  name: 'Public Squad',
  gameId: '00000000-0000-4000-8000-000000000002',
  maxMembers: 4,
  memberCount: 2,
  tags: ['ranked'],
  language: 'pt-br',
  expiresAt: new Date('2030-01-01T00:00:00Z'),
  createdAt: new Date('2030-01-01T00:00:00Z'),
  updatedAt: new Date('2030-01-01T00:00:00Z'),
}

describe('SquadController', () => {
  it('maps the public list intent to the public HTTP payload', async () => {
    const lifecycle = {
      listRecruitingSquads: vi.fn().mockResolvedValue([publicSquad]),
      getPublic: vi.fn(),
    }
    const reply = { send: vi.fn().mockResolvedValue(undefined) }
    const controller = new SquadController(lifecycle)

    await controller.list({} as never, reply as never)

    expect(lifecycle.listRecruitingSquads).toHaveBeenCalledOnce()
    expect(reply.send).toHaveBeenCalledWith({ squads: [publicSquad] })
  })

  it('maps an absent public Squad to a 404 response', async () => {
    const lifecycle = { listRecruitingSquads: vi.fn(), getPublic: vi.fn().mockResolvedValue(null) }
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockResolvedValue(undefined) }
    const controller = new SquadController(lifecycle)

    await controller.getPublic({ params: { code: 'GONE01' } } as never, reply as never)

    expect(lifecycle.getPublic).toHaveBeenCalledWith('GONE01')
    expect(reply.status).toHaveBeenCalledWith(404)
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Not Found',
      message: 'Recruiting Squad not found',
    })
  })
})
