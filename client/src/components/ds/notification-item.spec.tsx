/**
 * The notification row, one variant per type: an eyebrow in the type's tone, the title, the message
 * of what happened, the game with the relative time, the media (a cover or the avatar of who left)
 * with its badge, the unread marks and a dismiss button named after the Squad.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import ptBR from '@/locales/pt-BR.json'
import type { UserNotification } from '@/types'
import {
  hostTransferredNotification,
  memberLeftNotification,
  roomClosedByAdminNotification,
  roomClosedNotification,
  squadReadyNotification,
} from '@/test/fixtures'
import { NotificationItem, type NotificationItemProps } from './notification-item'

const SQUAD = squadReadyNotification.payload.roomName
const CODE = squadReadyNotification.payload.roomCode

function renderItem(
  notification: UserNotification = squadReadyNotification,
  props: Partial<NotificationItemProps> = {}
) {
  const onOpen = vi.fn()
  const onDismiss = vi.fn()
  const { container, unmount } = render(
    <ul>
      <NotificationItem
        notification={{ ...notification, createdAt: new Date().toISOString() }}
        onOpen={onOpen}
        onDismiss={onDismiss}
        {...props}
      />
    </ul>
  )
  return { onOpen, onDismiss, container, unmount }
}

function readVersion(notification: UserNotification): UserNotification {
  return { ...notification, readAt: '2026-01-01T00:00:00.000Z' }
}

function withPayload(payload: Partial<(typeof squadReadyNotification)['payload']>) {
  return { ...squadReadyNotification, payload: { ...squadReadyNotification.payload, ...payload } }
}

const players = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ name: `P${i + 1}`, image: null }))

describe('the eyebrow of each type', () => {
  it.each([
    [squadReadyNotification, 'Squad complete', 'text-mint'],
    [hostTransferredNotification, "You're the new owner", 'text-amber'],
    [memberLeftNotification, 'Member left', 'text-discord-soft'],
    [roomClosedNotification, 'Squad closed', 'text-danger'],
    [roomClosedByAdminNotification, 'Closed by moderation', 'text-danger'],
  ] as const)('labels a %#th type in its tone', (notification, eyebrow, tone) => {
    renderItem(notification)

    expect(screen.getByText(eyebrow).parentElement).toHaveClass(tone)
  })

  it('marks an unread row with the edge in its tone and no dot, and dims a read one', () => {
    const { unmount } = renderItem()
    const unreadLink = screen.getByRole('link')
    expect(unreadLink).toHaveClass('shadow-[inset_3px_0_0_var(--color-mint)]')
    expect(unreadLink.querySelector('.rounded-full.bg-mint')).toBeNull()
    unmount()

    renderItem(readVersion(squadReadyNotification))
    expect(screen.getByRole('link')).not.toHaveClass('shadow-[inset_3px_0_0_var(--color-mint)]')
    expect(screen.getByText('Squad complete').parentElement).toHaveClass('opacity-60')
  })
})

describe('a room_ready row', () => {
  it('shows the name, the message and the game with the time', () => {
    renderItem()

    const row = screen.getByRole('link', { name: new RegExp(`^${SQUAD}`) })
    expect(row).toHaveTextContent("Everyone's in. The Discord invite is unlocked.")
    expect(row).toHaveTextContent(`${squadReadyNotification.payload.gameName} · just now`)
  })

  it('marks an unread row with its tone edge and a hidden unread text', () => {
    renderItem()

    expect(screen.getByText('Unread')).toHaveClass('sr-only')
    expect(screen.getByRole('link', { name: new RegExp(`^${SQUAD}`) })).toHaveClass(
      'shadow-[inset_3px_0_0_var(--color-mint)]'
    )
  })

  it('has no unread text or edge on a read row and dims its media', () => {
    renderItem(readVersion(withPayload({ gameCoverUrl: 'https://cdn.squadzr.test/c.jpg' })))

    expect(screen.queryByText('Unread')).not.toBeInTheDocument()
    const row = screen.getByRole('link', { name: new RegExp(`^${SQUAD}`) })
    expect(row.className).not.toMatch(/inset_3px/)
    expect(document.querySelector('img')?.closest('.opacity-60')).toBeInTheDocument()
  })

  it('stacks the players before the game, at most five and a count of the rest', () => {
    const { unmount } = renderItem(withPayload({ players: players(7) }))

    expect(screen.getAllByText(/^P\d$/)).toHaveLength(5)
    expect(screen.getByText('+2')).toBeInTheDocument()
    unmount()

    renderItem(withPayload({ players: players(5) }))
    expect(screen.getAllByText(/^P\d$/)).toHaveLength(5)
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument()
  })

  it('keeps a placeholder without a cover and a Discord badge on the cover', () => {
    const { container } = renderItem()

    expect(document.querySelector('img')).toBeNull()
    expect(container.querySelector('.bg-discord')).toBeInTheDocument()
  })

  it('lists the squads the viewer left in chips, in the singular and in the plural', () => {
    const withLeft = (leftSquads: { roomCode: string; roomName: string }[]) =>
      withPayload({ leftSquads })
    const { rerender } = render(<ul />)
    rerender(
      <ul>
        <NotificationItem
          notification={withLeft([{ roomCode: 'BBB222', roomName: 'Squad B' }])}
          onOpen={vi.fn()}
          onDismiss={vi.fn()}
        />
      </ul>
    )
    expect(screen.getByText('You left 1 squad')).toBeInTheDocument()
    expect(screen.getByText('Squad B')).toHaveClass('border')

    rerender(
      <ul>
        <NotificationItem
          notification={withLeft([
            { roomCode: 'BBB222', roomName: 'Squad B' },
            { roomCode: 'CCC333', roomName: 'Squad C' },
          ])}
          onOpen={vi.fn()}
          onDismiss={vi.fn()}
        />
      </ul>
    )
    expect(screen.getByText('You left 2 squads')).toBeInTheDocument()
    expect(screen.getByText('Squad B')).toHaveClass('border')
    expect(screen.getByText('Squad C')).toHaveClass('border')
  })

  it('caps a long left squad name in its chip and keeps the full name in the tooltip', () => {
    const longName = 'A very long squad name that would otherwise stretch the notification row'
    renderItem(withPayload({ leftSquads: [{ roomCode: 'LNG111', roomName: longName }] }))

    const chip = screen.getByText(longName)
    expect(chip).toHaveClass('max-w-36', 'truncate')
    expect(chip).toHaveAttribute('title', longName)
  })

  it('has no line about left squads when the viewer left none', () => {
    renderItem()

    expect(screen.queryByText(/You left/)).not.toBeInTheDocument()
  })

  it('opens on the row and dismisses on its own button, named after the Squad', async () => {
    const user = userEvent.setup({ delay: null })
    const { onOpen, onDismiss } = renderItem()

    await user.click(screen.getByRole('link', { name: new RegExp(`^${SQUAD}`) }))
    await user.click(screen.getByRole('button', { name: `Dismiss notification for ${SQUAD}` }))

    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('is a link to the Squad that opens in place on a plain click only', async () => {
    const user = userEvent.setup({ delay: null })
    const { onOpen } = renderItem()
    const row = screen.getByRole('link', { name: new RegExp(`^${SQUAD}`) })

    expect(row).toHaveAttribute('href', `/squads/${CODE}`)

    await user.keyboard('{Control>}')
    await user.click(row)
    await user.keyboard('{/Control}')
    expect(onOpen).not.toHaveBeenCalled()

    await user.click(row)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('reveals the dismiss button on focus', async () => {
    const user = userEvent.setup({ delay: null })
    renderItem()

    await user.tab()
    await user.tab()

    expect(screen.getByRole('button', { name: /^Dismiss notification/ })).toHaveFocus()
  })

  it('waits while disabled: a click does not open the row', async () => {
    const user = userEvent.setup({ delay: null })
    const { onOpen } = renderItem(squadReadyNotification, { disabled: true })

    await user.click(screen.getByRole('link', { name: new RegExp(`^${SQUAD}`) }))

    expect(onOpen).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /^Dismiss notification/ })).toBeDisabled()
  })
})

describe('a host_transferred row', () => {
  it('says the viewer is the new owner and who left, with a crown on the cover', () => {
    const { container } = renderItem(hostTransferredNotification)

    const row = screen.getByRole('link', { name: `You are the new owner of ${SQUAD}, Unread` })
    expect(row).toHaveTextContent(
      'Caio left because another squad of theirs filled. The squad is yours now.'
    )
    expect(screen.getByText('Caio').tagName).toBe('B')
    expect(container.querySelector('.bg-amber .lucide-crown')).toBeInTheDocument()
    expect(container.querySelector('.bg-discord')).toBeNull()
  })

  it('opens the Lobby of the Squad', () => {
    renderItem(hostTransferredNotification)

    expect(screen.getByRole('link')).toHaveAttribute('href', `/squads/${CODE}`)
  })
})

describe('a member_left row', () => {
  it('shows who left in the avatar and the message, and names the row after the action', () => {
    const { container } = renderItem(memberLeftNotification)

    const row = screen.getByRole('link', { name: `Ana left ${SQUAD}, Unread` })
    expect(row).toHaveTextContent('They joined another squad that filled. A slot opened up.')
    expect(container.querySelector('.bg-discord-soft .lucide-user-minus')).toBeInTheDocument()
    expect(within(row).getByText('AN')).toBeInTheDocument()
  })

  it('titles the row with who left and the Squad name in a tinted chip', () => {
    renderItem(memberLeftNotification)

    const squad = screen.getByText(SQUAD)
    expect(squad).toHaveClass('bg-discord-soft/13')
    expect(squad.parentElement).toHaveTextContent(`Ana left ${SQUAD}`)
  })

  it('names a read row after the action without the unread text', () => {
    renderItem(readVersion(memberLeftNotification))

    expect(screen.getByRole('link', { name: `Ana left ${SQUAD}` })).toBeInTheDocument()
  })

  it('opens the Lobby of the Squad', () => {
    renderItem(memberLeftNotification)

    expect(screen.getByRole('link')).toHaveAttribute('href', `/squads/${CODE}`)
  })
})

describe('a room_closed row', () => {
  it('says the Squad was closed, with a grey cover even when unread', () => {
    const closed = {
      ...roomClosedNotification,
      payload: {
        ...roomClosedNotification.payload,
        gameCoverUrl: 'https://cdn.squadzr.test/c.jpg',
      },
    }
    const { container } = renderItem(closed)

    const row = screen.getByRole('link', { name: `${SQUAD} was closed, Unread` })
    expect(row).toHaveTextContent('The owner, Caio, left and nobody who stayed could take over.')
    expect(screen.getByText(SQUAD)).toHaveClass('line-through', 'text-text-3')
    expect(document.querySelector('img')).toHaveClass('grayscale')
    expect(container.querySelector('.lucide-door-closed')).toBeInTheDocument()
  })

  it('leads to the Squad Board, because the Lobby no longer exists', () => {
    renderItem(roomClosedNotification)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/squads')
  })
})

describe('a room_closed_by_admin row', () => {
  it('says moderation closed the Squad and quotes the reason, naming no admin', () => {
    const { container } = renderItem(roomClosedByAdminNotification)

    const row = screen.getByRole('link', {
      name: `${SQUAD} was closed by moderation: Offensive squad name, Unread`,
    })
    expect(row).toHaveTextContent('This squad was closed by Squadzr moderation.')
    expect(row).toHaveTextContent('“Offensive squad name”')
    expect(screen.getByText(SQUAD)).toHaveClass('line-through')
    expect(container.querySelector('.lucide-shield-alert')).toBeInTheDocument()
  })

  it('says it in Brazilian Portuguese, with the reason quoted', () => {
    render(
      <NextIntlClientProvider locale="pt-BR" messages={ptBR}>
        <ul>
          <NotificationItem
            notification={{ ...roomClosedByAdminNotification, createdAt: new Date().toISOString() }}
            onOpen={vi.fn()}
            onDismiss={vi.fn()}
          />
        </ul>
      </NextIntlClientProvider>
    )

    const row = screen.getByRole('link', {
      name: `${SQUAD} foi fechado pela moderação: Offensive squad name, Não lida`,
    })
    expect(row).toHaveTextContent('Fechado pela moderação')
    expect(row).toHaveTextContent('Este squad foi fechado pela moderação do Squadzr.')
    expect(row).toHaveTextContent('“Offensive squad name”')
  })

  it('leads to the Squad Board, because the Lobby no longer exists', () => {
    renderItem(roomClosedByAdminNotification)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/squads')
  })
})
