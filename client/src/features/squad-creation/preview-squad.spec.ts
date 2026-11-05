import { describe, expect, it } from 'vitest'
import { gameLol } from '../../test/fixtures'
import { MASKED_CODE, previewSquad } from './preview-squad'

const viewer = {
  id: 'user-1',
  name: 'Caio',
  email: 'caio@squadzr.test',
  image: null,
  role: 'user' as const,
}
const values = { name: ' Night ranked ', tags: ['ranked'], language: 'en' as const, maxPlayers: 4 }

describe('previewSquad', () => {
  it('builds the card from the form: the game, the name, the language, the tags and the size', () => {
    const squad = previewSquad({ game: gameLol, values, viewer, nameFallback: 'Squad name' })

    expect(squad).toMatchObject({
      name: 'Night ranked',
      language: 'en',
      tags: ['ranked'],
      maxPlayers: 4,
      game: { id: gameLol.id, name: gameLol.name, coverUrl: gameLol.coverUrl },
    })
  })

  it('carries the chosen platform, or none', () => {
    const chosen = previewSquad({
      game: gameLol,
      values: { ...values, platform: 'ps5' },
      viewer,
      nameFallback: 'Squad name',
    })
    const unchosen = previewSquad({ game: gameLol, values, viewer, nameFallback: 'Squad name' })

    expect(chosen.platform).toBe('ps5')
    expect(unchosen.platform).toBeNull()
  })

  it('has the viewer as its only member and a masked six-character code', () => {
    const squad = previewSquad({ game: gameLol, values, viewer, nameFallback: 'Squad name' })

    expect(squad.memberCount).toBe(1)
    expect(squad.memberPreview).toEqual([{ id: 'user-1', name: 'Caio', image: null }])
    expect(squad.code).toBe(MASKED_CODE)
    expect(squad.code).toHaveLength(6)
  })

  it('names the card with the fallback while the name is blank', () => {
    const squad = previewSquad({
      game: gameLol,
      values: { ...values, name: '   ' },
      viewer,
      nameFallback: 'Squad name',
    })

    expect(squad.name).toBe('Squad name')
  })
})
