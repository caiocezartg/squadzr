import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GetDiscordPreviewUseCase } from './get-discord-preview.use-case'
import { RoomNotFoundError, RoomNotReadyError } from '@application/errors'
import type {
  DiscordInvitePreviewOutcome,
  DiscordInvitePreviewProvider,
  DiscordServerPreview,
} from '@domain/services/discord-invite-preview-provider.interface'
import {
  createMockClock,
  createMockRoom,
  createMockRoomMember,
  createMockRoomMemberRepository,
  createMockRoomRepository,
} from '@test/mocks'

const NOW = new Date('2026-01-01T00:00:00.000Z')

const PREVIEW: DiscordServerPreview = {
  name: 'VALORANT',
  iconUrl: 'https://cdn.discordapp.com/icons/1/abc.png?size=128',
  backdropUrl: null,
  memberCount: 2_946_792,
  onlineCount: 362_025,
  expiresAt: null,
}

describe('GetDiscordPreviewUseCase', () => {
  let rooms: ReturnType<typeof createMockRoomRepository>
  let members: ReturnType<typeof createMockRoomMemberRepository>
  let provider: { fetch: ReturnType<typeof vi.fn<DiscordInvitePreviewProvider['fetch']>> }
  let useCase: GetDiscordPreviewUseCase

  const readyRoom = (overrides = {}) =>
    createMockRoom({
      code: 'ABC123',
      discordLink: 'https://discord.gg/valorant',
      readyAt: NOW,
      lastActivityAt: NOW,
      createdAt: NOW,
      ...overrides,
    })

  const answers = (outcome: DiscordInvitePreviewOutcome) =>
    provider.fetch.mockResolvedValue(outcome)

  beforeEach(() => {
    rooms = createMockRoomRepository()
    members = createMockRoomMemberRepository()
    provider = { fetch: vi.fn<DiscordInvitePreviewProvider['fetch']>() }
    useCase = new GetDiscordPreviewUseCase(rooms, members, createMockClock(NOW), provider)

    rooms.findByCode.mockResolvedValue(readyRoom())
    members.findByRoomAndUser.mockResolvedValue(createMockRoomMember({ userId: 'member-1' }))
  })

  it('returns the server behind the invite to a member of a Ready Squad', async () => {
    answers({ kind: 'found', preview: PREVIEW })

    await expect(useCase.execute({ code: 'ABC123', viewerId: 'member-1' })).resolves.toEqual({
      preview: PREVIEW,
    })
    expect(provider.fetch).toHaveBeenCalledWith('valorant')
  })

  it('asks Discord about the code only, not the query string or trailing path of the link', async () => {
    rooms.findByCode.mockResolvedValue(
      readyRoom({ discordLink: 'https://discord.com/invite/valorant/?event=1' })
    )
    answers({ kind: 'found', preview: PREVIEW })

    await useCase.execute({ code: 'ABC123', viewerId: 'member-1' })

    expect(provider.fetch).toHaveBeenCalledWith('valorant')
  })

  it.each<[string, DiscordInvitePreviewOutcome]>([
    ['an invalid or expired invite', { kind: 'invalid' }],
    ['Discord being down or slow', { kind: 'unreachable' }],
    ['Discord rate limiting', { kind: 'rate_limited' }],
  ])('returns no preview for %s', async (_, outcome) => {
    answers(outcome)

    await expect(useCase.execute({ code: 'ABC123', viewerId: 'member-1' })).resolves.toEqual({
      preview: null,
    })
  })

  it.each([null, 'https://discord.gg/', 'https://discord.gg/../x', 'https://example.com/abc'])(
    'returns no preview, without asking Discord, for the link %j',
    async (discordLink) => {
      rooms.findByCode.mockResolvedValue(readyRoom({ discordLink }))

      await expect(useCase.execute({ code: 'ABC123', viewerId: 'member-1' })).resolves.toEqual({
        preview: null,
      })
      expect(provider.fetch).not.toHaveBeenCalled()
    }
  )

  it('hides the Squad from a viewer who is not a member', async () => {
    members.findByRoomAndUser.mockResolvedValue(null)

    await expect(useCase.execute({ code: 'ABC123', viewerId: 'stranger' })).rejects.toThrow(
      RoomNotFoundError
    )
    expect(provider.fetch).not.toHaveBeenCalled()
  })

  it('hides an Open Squad from a viewer who is not a member', async () => {
    rooms.findByCode.mockResolvedValue(readyRoom({ readyAt: null }))
    members.findByRoomAndUser.mockResolvedValue(null)

    await expect(useCase.execute({ code: 'ABC123', viewerId: 'stranger' })).rejects.toThrow(
      RoomNotFoundError
    )
    expect(provider.fetch).not.toHaveBeenCalled()
  })

  it('refuses a member of a Squad that is not Ready yet', async () => {
    rooms.findByCode.mockResolvedValue(readyRoom({ readyAt: null }))

    await expect(useCase.execute({ code: 'ABC123', viewerId: 'member-1' })).rejects.toThrow(
      RoomNotReadyError
    )
    expect(provider.fetch).not.toHaveBeenCalled()
  })

  it('throws RoomNotFoundError for a Squad that does not exist', async () => {
    rooms.findByCode.mockResolvedValue(null)

    await expect(useCase.execute({ code: 'NOPE00', viewerId: 'member-1' })).rejects.toThrow(
      RoomNotFoundError
    )
  })
})
