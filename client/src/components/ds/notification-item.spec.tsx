/**
 * The notification row, one variant per type: the Squad name, the message of what happened, the
 * game with the relative time, the media (a cover or the avatar of who left) with its badge, the
 * unread marks and a dismiss button named after the Squad.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { UserNotification } from '@/types'
import {
  hostTransferredNotification,
  memberLeftNotification,
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
  const { container } = render(
    <ul>
      <NotificationItem
        notification={{ ...notification, createdAt: new Date().toISOString() }}
        onOpen={onOpen}
        onDismiss={onDismiss}
        {...props}
      />
    </ul>
  )
  return { onOpen, onDismiss, container }
}

function readVersion(notification: UserNotification): UserNotification {
  return { ...notification, readAt: '2026-01-01T00:00:00.000Z' }
}

describe('a room_ready row', () => {
  it('shows the name, the message and the game with the time', () => {
    renderItem()

    const row = screen.getByRole('link', { name: new RegExp(`^${SQUAD}`) })
    expect(row).toHaveTextContent('Squad complete · invite unlocked')
    expect(row).toHaveTextContent(`${squadReadyNotification.payload.gameName} · just now`)
  })

  it('marks an unread row with a bold name and a hidden unread text', () => {
    renderItem()

    expect(screen.getByText('Unread')).toHaveClass('sr-only')
    expect(screen.getByText(SQUAD)).toHaveClass('font-bold')
  })

  it('has no unread text on a read row and greys its cover', () => {
    renderItem(
      readVersion({
        ...squadReadyNotification,
        payload: {
          ...squadReadyNotification.payload,
          gameCoverUrl: 'https://cdn.squadzr.test/c.jpg',
        },
      })
    )

    expect(screen.queryByText('Unread')).not.toBeInTheDocument()
    expect(document.querySelector('img')).toHaveClass('grayscale-60')
  })

  it('keeps a placeholder without a cover and a Discord badge on the cover', () => {
    const { container } = renderItem()

    expect(document.querySelector('img')).toBeNull()
    expect(container.querySelector('.bg-discord')).toBeInTheDocument()
  })

  it('lists the squads the viewer left, in the singular and in the plural', () => {
    const withLeft = (leftSquads: { roomCode: string; roomName: string }[]) => ({
      ...squadReadyNotification,
      payload: { ...squadReadyNotification.payload, leftSquads },
    })
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
    expect(screen.getByText('You left 1 other squad: Squad B.')).toBeInTheDocument()

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
    expect(screen.getByText('You left 2 other squads: Squad B, Squad C.')).toBeInTheDocument()
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
    expect(row).toHaveTextContent('You are the new owner · Caio left')
    expect(container.querySelector('.lucide-crown')).toBeInTheDocument()
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
    expect(row).toHaveTextContent('Ana left · joined another squad that filled')
    expect(container.querySelector('.lucide-user-minus')).toBeInTheDocument()
    expect(within(row).getByText('AN')).toBeInTheDocument()
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
    expect(row).toHaveTextContent('Squad closed · the owner left and nobody could take over')
    expect(document.querySelector('img')).toHaveClass('grayscale')
    expect(document.querySelector('img')).not.toHaveClass('grayscale-60')
    expect(container.querySelector('.lucide-door-closed')).toBeInTheDocument()
  })

  it('leads to the Squad Board, because the Lobby no longer exists', () => {
    renderItem(roomClosedNotification)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/squads')
  })
})
