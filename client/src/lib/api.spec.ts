/**
 * The HTTP transport seam: a response only leaves `api` after it parsed against its
 * contract from @squadzr/schemas. HTTP runs through the deterministic adapter
 * (src/test/http-router).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { roomResponseSchema, roomsResponseSchema } from '@squadzr/schemas'
import { ApiClientError, ApiContractError, api } from './api'
import { getUserFriendlyError } from './error-messages'
import { getHttpLog, httpError, httpOk, onHttp } from '@/test/http-router'
import { hostPlayer, lobbyRoom, openRoom } from '@/test/fixtures'

const SECRET_INVITE = 'https://discord.gg/secret-invite'

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('valid responses', () => {
  it('returns the parsed body with dates as ISO strings', async () => {
    onHttp('GET', '/api/rooms', () => httpOk({ rooms: [openRoom] }))

    const { rooms } = await api.get('/api/rooms', roomsResponseSchema)

    expect(rooms[0]?.createdAt).toBe(openRoom.createdAt)
    expect(typeof rooms[0]?.createdAt).toBe('string')
    expect(console.error).not.toHaveBeenCalled()
  })

  it('keeps only the public projection of a catalog room', async () => {
    onHttp('GET', '/api/rooms', () =>
      httpOk({ rooms: [{ ...openRoom, discordLink: SECRET_INVITE }], players: [hostPlayer] })
    )

    const response = await api.get('/api/rooms', roomsResponseSchema)

    expect(response.rooms[0]).not.toHaveProperty('discordLink')
    expect(JSON.stringify(response)).not.toContain(SECRET_INVITE)
    expect(response).not.toHaveProperty('players')
  })

  it('returns lobby details for a member and the public projection otherwise', async () => {
    const { discordLink: _discordLink, ...publicRoom } = lobbyRoom
    onHttp('GET', '/api/rooms/:code', (req) =>
      httpOk(
        req.params.code === 'LOBBY1'
          ? { room: lobbyRoom, players: [hostPlayer] }
          : { room: publicRoom }
      )
    )

    const asMember = await api.get('/api/rooms/LOBBY1', roomResponseSchema)
    const asOutsider = await api.get('/api/rooms/OTHER1', roomResponseSchema)

    expect(asMember).toEqual({ room: lobbyRoom, players: [hostPlayer] })
    expect(asOutsider).toEqual({ room: publicRoom })
  })
})

describe('invalid responses', () => {
  it.each([
    ['a missing collection', {}],
    ['a room without an id', { rooms: [{ ...openRoom, id: undefined }] }],
    ['a date that is not an ISO string', { rooms: [{ ...openRoom, createdAt: 1_769_000_000 }] }],
    ['an unknown status', { rooms: [{ ...openRoom, status: 'archived' }] }],
  ])('rejects %s with a typed ApiContractError', async (_label, body) => {
    onHttp('GET', '/api/rooms', () => httpOk(body))

    const error = await api.get('/api/rooms', roomsResponseSchema).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiContractError)
    expect(error).toMatchObject({
      name: 'ApiContractError',
      code: 'INVALID_RESPONSE',
      method: 'GET',
      path: '/api/rooms',
    })
    expect((error as ApiContractError).issues.length).toBeGreaterThan(0)
  })

  it('logs structured diagnostics without the response body or the query string', async () => {
    onHttp('GET', '/api/rooms/:code', () =>
      httpOk({
        room: { ...lobbyRoom, discordLink: SECRET_INVITE, createdAt: 'yesterday' },
        players: [hostPlayer],
      })
    )

    const error = await api
      .get('/api/rooms/LOBBY1?token=session-secret', roomResponseSchema)
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiContractError)
    expect(console.error).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalledWith('Invalid API response:', {
      method: 'GET',
      path: '/api/rooms/LOBBY1',
      issues: expect.arrayContaining([{ path: 'room.createdAt', code: 'invalid_format' }]),
    })
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls)
    expect(logged).not.toContain(SECRET_INVITE)
    expect(logged).not.toContain('session-secret')
    expect(logged).not.toContain(hostPlayer.name)
    expect(JSON.stringify(error)).not.toContain(SECRET_INVITE)
  })

  it('shows the generic friendly message for a contract error', async () => {
    onHttp('GET', '/api/rooms', () => httpOk({ rooms: 'nope' }))

    const error = await api.get('/api/rooms', roomsResponseSchema).catch((e: unknown) => e)

    expect(getUserFriendlyError(error)).toBe('Something went wrong. Please try again.')
  })
})

describe('error responses and commands', () => {
  it('keeps mapping HTTP errors to ApiClientError with the server code', async () => {
    onHttp('GET', '/api/rooms/:code', () =>
      httpError(404, { message: 'Squad not found', error: 'ROOM_NOT_FOUND' })
    )

    const error = await api.get('/api/rooms/ZZZZZZ', roomResponseSchema).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiClientError)
    expect(error).toMatchObject({ status: 404, code: 'ROOM_NOT_FOUND', message: 'Squad not found' })
  })

  it('discards the body of a command sent without a schema', async () => {
    onHttp('POST', '/api/rooms/:code/leave', () => httpOk({ anything: SECRET_INVITE }))

    const result = await api.post('/api/rooms/LOBBY1/leave', {})

    expect(result).toBeUndefined()
    expect(getHttpLog().at(-1)).toMatchObject({ method: 'POST', path: '/api/rooms/LOBBY1/leave' })
  })
})
