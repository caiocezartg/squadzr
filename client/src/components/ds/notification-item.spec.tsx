/**
 * The notification row: the Squad name, the message, the game with the relative time, the cover or
 * its placeholder, the unread marks and a dismiss button named after the Squad.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NotificationItem, type NotificationItemProps } from './notification-item'

function renderItem(props: Partial<NotificationItemProps> = {}) {
  const onOpen = vi.fn()
  const onDismiss = vi.fn()
  render(
    <ul>
      <NotificationItem
        squadName="Ranked grind"
        gameName="Valorant"
        createdAt={new Date().toISOString()}
        unread
        href="/squads/ABC123"
        onOpen={onOpen}
        onDismiss={onDismiss}
        {...props}
      />
    </ul>
  )
  return { onOpen, onDismiss }
}

describe('notification item', () => {
  it('shows the name, the message and the game with the time', () => {
    renderItem()

    const row = screen.getByRole('link', { name: /^Ranked grind/ })
    expect(row).toHaveTextContent('Discord invite unlocked')
    expect(row).toHaveTextContent('Valorant · just now')
  })

  it('marks an unread row with a bold name and an accessible dot', () => {
    renderItem()

    expect(screen.getByRole('img', { name: 'Unread' })).toBeInTheDocument()
    expect(screen.getByText('Ranked grind')).toHaveClass('font-bold')
  })

  it('has no dot on a read row and greys its cover', () => {
    renderItem({ unread: false, coverUrl: 'https://cdn.squadzr.test/c.jpg' })

    expect(screen.queryByRole('img', { name: 'Unread' })).not.toBeInTheDocument()
    expect(document.querySelector('img')).toHaveClass('grayscale-60')
  })

  it('keeps a placeholder without a cover', () => {
    renderItem()

    expect(document.querySelector('img')).toBeNull()
  })

  it('opens on the row and dismisses on its own button, named after the Squad', async () => {
    const user = userEvent.setup({ delay: null })
    const { onOpen, onDismiss } = renderItem()

    await user.click(screen.getByRole('link', { name: /^Ranked grind/ }))
    await user.click(screen.getByRole('button', { name: 'Dismiss notification for Ranked grind' }))

    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('is a link to the Squad that opens in place on a plain click only', async () => {
    const user = userEvent.setup({ delay: null })
    const { onOpen } = renderItem()
    const row = screen.getByRole('link', { name: /^Ranked grind/ })

    expect(row).toHaveAttribute('href', '/squads/ABC123')

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
})
