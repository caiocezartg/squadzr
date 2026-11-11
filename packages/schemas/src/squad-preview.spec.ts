import { describe, expect, it } from 'vitest'
import { parseSquadPreviewPath, squadPreviewImagePath } from './squad-preview'

const GAME_ID = 'c6b3f931-0493-4091-9c3b-b44613fb3da4'
const path = (rest: string) => `/og/squad/v1/${rest}`

describe('squadPreviewImagePath', () => {
  it('spells the design version and the key in the path', () => {
    expect(squadPreviewImagePath({ gameId: GAME_ID, filled: 3, total: 5, language: 'pt-br' })).toBe(
      `/og/squad/v1/${GAME_ID}/3-5/pt-br.jpg`
    )
  })

  it('reads back as the same key', () => {
    const key = { gameId: GAME_ID, filled: 1, total: 10, language: 'en' } as const

    expect(parseSquadPreviewPath(squadPreviewImagePath(key))).toEqual(key)
  })
})

describe('parseSquadPreviewPath', () => {
  it('reads a key from its path', () => {
    expect(parseSquadPreviewPath(path(`${GAME_ID}/2-5/en.jpg`))).toEqual({
      gameId: GAME_ID,
      filled: 2,
      total: 5,
      language: 'en',
    })
  })

  it.each([
    ['a full Squad', `${GAME_ID}/5-5/en.jpg`],
    ['the smallest Squad', `${GAME_ID}/1-2/en.jpg`],
    ['the largest Squad', `${GAME_ID}/40-40/en.jpg`],
  ])('accepts %s', (_label, rest) => {
    expect(parseSquadPreviewPath(path(rest))).not.toBeNull()
  })

  it.each([
    ['more filled slots than the total', path(`${GAME_ID}/6-5/en.jpg`)],
    ['no filled slot', path(`${GAME_ID}/0-5/en.jpg`)],
    ['a one-slot Squad', path(`${GAME_ID}/1-1/en.jpg`)],
    ['a leading zero', path(`${GAME_ID}/02-5/en.jpg`)],
    ['a total above the largest Squad', path(`${GAME_ID}/2-41/en.jpg`)],
    ['a three-digit count', path(`${GAME_ID}/2-100/en.jpg`)],
    ['a fraction', path(`${GAME_ID}/2.5-5/en.jpg`)],
    ['an unknown language', path(`${GAME_ID}/2-5/es.jpg`)],
    ['an uppercase language', path(`${GAME_ID}/2-5/EN.jpg`)],
    ['an uppercase game id', path(`${GAME_ID.toUpperCase()}/2-5/en.jpg`)],
    ['a game id that is not a UUID', path('valorant/2-5/en.jpg')],
    ['another extension', path(`${GAME_ID}/2-5/en.png`)],
    ['a trailing segment', path(`${GAME_ID}/2-5/en.jpg/x`)],
    ['a missing count', path(`${GAME_ID}/5/en.jpg`)],
    ['another design version', `/og/squad/v0/${GAME_ID}/2-5/en.jpg`],
    ['no design version', `/og/squad/${GAME_ID}/2-5/en.jpg`],
    ['another prefix', `/og/squads/v1/${GAME_ID}/2-5/en.jpg`],
    ['the bare prefix', '/og/squad/'],
  ])('rejects %s', (_label, value) => {
    expect(parseSquadPreviewPath(value)).toBeNull()
  })
})
