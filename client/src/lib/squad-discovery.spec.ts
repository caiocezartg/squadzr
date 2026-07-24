import { describe, expect, it } from 'vitest'
import { filterRecruitingSquads } from './squad-discovery'

const squads = [
  {
    id: '1',
    code: 'ONE001',
    name: 'Ranked Squad',
    gameId: 'game-1',
    maxMembers: 4,
    memberCount: 3,
    tags: ['ranked'],
    language: 'pt-br' as const,
    expiresAt: new Date('2030-01-01'),
    createdAt: new Date('2029-01-01'),
    updatedAt: new Date('2029-01-01'),
  },
  {
    id: '2',
    code: 'TWO002',
    name: 'Casual Squad',
    gameId: 'game-2',
    maxMembers: 4,
    memberCount: 1,
    tags: ['casual'],
    language: 'en' as const,
    expiresAt: new Date('2029-01-01'),
    createdAt: new Date('2030-01-01'),
    updatedAt: new Date('2030-01-01'),
  },
]

describe('filterRecruitingSquads', () => {
  it('filters public Squads by game, language, tag, and capacity', () => {
    const games = new Map([
      ['game-1', { id: 'game-1', name: 'Valorant' }],
      ['game-2', { id: 'game-2', name: 'Minecraft' }],
    ])

    expect(
      filterRecruitingSquads(squads, games as never, {
        search: 'valorant',
        language: 'pt-br',
        tag: '#rank',
        capacity: 'almost-full',
      })
    ).toEqual([squads[0]])
  })
})
