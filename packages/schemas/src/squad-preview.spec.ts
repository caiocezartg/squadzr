import { describe, expect, it } from 'vitest'
import { parseSquadPreviewPath, squadPreviewImagePath } from './squad-preview'

const GAME_ID = 'c6b3f931-0493-4091-9c3b-b44613fb3da4'

describe('squadPreviewImagePath', () => {
  it('spells the key in the path', () => {
    expect(squadPreviewImagePath({ gameId: GAME_ID, filled: 3, total: 5, language: 'pt-br' })).toBe(
      `/og/squad/${GAME_ID}/3-5/pt-br.jpg`
    )
  })

  it('reads back as the same key', () => {
    const key = { gameId: GAME_ID, filled: 1, total: 10, language: 'en' } as const

    expect(parseSquadPreviewPath(squadPreviewImagePath(key))).toEqual(key)
  })
})

describe('parseSquadPreviewPath', () => {
  it('reads a key from its path', () => {
    expect(parseSquadPreviewPath(`/og/squad/${GAME_ID}/2-5/en.jpg`)).toEqual({
      gameId: GAME_ID,
      filled: 2,
      total: 5,
      language: 'en',
    })
  })

  it('accepts a full Squad', () => {
    expect(parseSquadPreviewPath(`/og/squad/${GAME_ID}/5-5/en.jpg`)).toMatchObject({ filled: 5 })
  })

  it.each([
    ['more filled slots than the total', `/og/squad/${GAME_ID}/6-5/en.jpg`],
    ['no filled slot', `/og/squad/${GAME_ID}/0-5/en.jpg`],
    ['a leading zero', `/og/squad/${GAME_ID}/02-5/en.jpg`],
    ['a total above the largest Squad', `/og/squad/${GAME_ID}/2-41/en.jpg`],
    ['a three-digit count', `/og/squad/${GAME_ID}/2-100/en.jpg`],
    ['a fraction', `/og/squad/${GAME_ID}/2.5-5/en.jpg`],
    ['an unknown language', `/og/squad/${GAME_ID}/2-5/es.jpg`],
    ['an uppercase language', `/og/squad/${GAME_ID}/2-5/EN.jpg`],
    ['an uppercase game id', `/og/squad/${GAME_ID.toUpperCase()}/2-5/en.jpg`],
    ['a game id that is not a UUID', '/og/squad/valorant/2-5/en.jpg'],
    ['another extension', `/og/squad/${GAME_ID}/2-5/en.png`],
    ['a trailing segment', `/og/squad/${GAME_ID}/2-5/en.jpg/x`],
    ['a missing count', `/og/squad/${GAME_ID}/5/en.jpg`],
    ['another prefix', `/og/squads/${GAME_ID}/2-5/en.jpg`],
    ['the bare prefix', '/og/squad/'],
  ])('rejects %s', (_label, path) => {
    expect(parseSquadPreviewPath(path)).toBeNull()
  })
})
