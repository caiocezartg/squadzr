/**
 * The member tile (CCC-102). Presence is text, never colour alone: a row in the room now, a row out of
 * it (with how long ago when known) and an open slot each say so in words, as the row's accessible
 * text and tooltip.
 */

import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemberTile, type MemberTileProps } from './member-tile'

function renderTile(props: MemberTileProps) {
  render(
    <ul>
      <MemberTile {...props} />
    </ul>
  )
  return screen.getByRole('listitem')
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

describe('MemberTile', () => {
  it('reads a player in the room as "In the room now"', () => {
    const row = renderTile({ playerId: 'p1', name: 'caiocezar', online: true })

    expect(within(row).getByText('caiocezar')).toBeInTheDocument()
    expect(row).toHaveTextContent('In the room now')
    expect(row).toHaveAttribute('title', 'In the room now')
  })

  it('reads a player who left as "Out of the room" with how long ago', () => {
    const row = renderTile({
      playerId: 'p1',
      name: 'mia',
      online: false,
      offlineSince: minutesAgo(5),
    })

    expect(row).toHaveTextContent('Out of the room · 5m ago')
    expect(row).toHaveAttribute('title', 'Out of the room · 5m ago')
  })

  it('reads a player who left at an unknown time as "Out of the room"', () => {
    const row = renderTile({ playerId: 'p1', name: 'mia', online: false, offlineSince: null })

    expect(row).toHaveTextContent('Out of the room')
    expect(row).not.toHaveTextContent('·')
    expect(row).toHaveAttribute('title', 'Out of the room')
  })

  it('reads an open slot as "Open slot", waiting for a player', () => {
    const row = renderTile({ open: true })

    expect(within(row).getByText('Open slot')).toBeInTheDocument()
    expect(row).toHaveTextContent('Waiting for a player')
    expect(row).toHaveAttribute('title', 'Waiting for a player')
    expect(within(row).queryByRole('img')).not.toBeInTheDocument()
  })

  it('marks the viewer with "you"', () => {
    const row = renderTile({ playerId: 'p1', name: 'caiocezar', online: true, you: true })

    expect(within(row).getByText('you')).toBeInTheDocument()
  })

  it('does not mark other players with "you"', () => {
    const row = renderTile({ playerId: 'p2', name: 'mia', online: true })

    expect(within(row).queryByText('you')).not.toBeInTheDocument()
  })

  it('shows the host crown named "Host"', () => {
    const row = renderTile({ playerId: 'p1', name: 'caiocezar', online: true, host: true })

    expect(within(row).getByRole('img', { name: 'Host' })).toBeInTheDocument()
  })

  it('shows no crown for a guest', () => {
    const row = renderTile({ playerId: 'p2', name: 'mia', online: true })

    expect(within(row).queryByRole('img', { name: 'Host' })).not.toBeInTheDocument()
  })

  it('shows the initials of a player with no Discord image', () => {
    const row = renderTile({ playerId: 'p2', name: 'mia', image: null, online: true })

    expect(within(row).getByText('MI')).toBeInTheDocument()
  })
})
