/**
 * The shared avatar (CCC-102). The Discord image shows when there is one; initials on a colour pair
 * picked from the player's id show when there is none or it fails to load. The host crown is named,
 * and the avatar itself is decorative unless it is given a label.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Avatar } from './avatar'
import { pickAvatarColors } from './avatar-colors'

const IMAGE_URL = 'https://cdn.discordapp.com/avatars/1/avatar.png'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Avatar', () => {
  it('shows the Discord image while it loads, not the initials', () => {
    const { container } = render(<Avatar playerId="p1" name="Caio Cezar" image={IMAGE_URL} />)

    expect(container.querySelector('img')).not.toBeNull()
    expect(screen.queryByText('CC')).not.toBeInTheDocument()
  })

  it('shows the initials when there is no image', () => {
    const { container } = render(<Avatar playerId="p1" name="Caio Cezar" image={null} />)

    expect(screen.getByText('CC')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })

  it('falls back to the initials when the image fails to load', () => {
    const { container } = render(<Avatar playerId="p1" name="Caio Cezar" image={IMAGE_URL} />)

    fireEvent.error(container.querySelector('img')!)

    expect(screen.getByText('CC')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })

  it('falls back to the initials when the image failed before React attached its handler', () => {
    // A failed image reports itself complete with no natural size; jsdom loads nothing, so the
    // state is set here.
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true)

    render(<Avatar playerId="p1" name="Caio Cezar" image={IMAGE_URL} />)

    expect(screen.getByText('CC')).toBeInTheDocument()
  })

  it('gives a different image its own try after one failed', () => {
    const { container, rerender } = render(<Avatar playerId="p1" name="Caio" image={IMAGE_URL} />)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).toBeNull()

    rerender(
      <Avatar playerId="p1" name="Caio" image="https://cdn.discordapp.com/avatars/1/new.png" />
    )

    expect(container.querySelector('img')).not.toBeNull()
  })

  it('takes two letters from a one-word name and the first and last initial from several words', () => {
    const { rerender } = render(<Avatar playerId="p1" name="caiocezar" />)
    expect(screen.getByText('CA')).toBeInTheDocument()

    rerender(<Avatar playerId="p1" name="mia van der berg" />)
    expect(screen.getByText('MB')).toBeInTheDocument()
  })

  it('paints the initials with the colour pair picked from the player id', () => {
    const colors = pickAvatarColors('player-7')
    render(<Avatar playerId="player-7" name="Mia" />)

    expect(screen.getByText('MI')).toHaveStyle({
      backgroundColor: colors.background,
      color: colors.foreground,
    })
  })

  it('paints the same player the same colours at every size and state', () => {
    render(
      <>
        <Avatar playerId="player-7" name="Mia" size={28} />
        <Avatar playerId="player-7" name="Mia" size={44} state="online" />
      </>
    )

    const [small, large] = screen.getAllByText('MI')
    expect(small!.style.backgroundColor).not.toBe('')
    expect(small!.style.backgroundColor).toBe(large!.style.backgroundColor)
  })

  it('is decorative without a label, because its parent names the player', () => {
    render(<Avatar playerId="p1" name="Caio" image={IMAGE_URL} />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('is an image named by its label when it has one', () => {
    render(<Avatar playerId="p1" name="Caio" label="Caio, in the room" state="online" />)

    expect(screen.getByRole('img', { name: 'Caio, in the room' })).toBeInTheDocument()
  })

  it('shows the host crown as an image named "Host"', () => {
    const { rerender } = render(<Avatar playerId="p1" name="Caio" host />)
    expect(screen.getByRole('img', { name: 'Host' })).toBeInTheDocument()

    rerender(<Avatar playerId="p1" name="Caio" />)
    expect(screen.queryByRole('img', { name: 'Host' })).not.toBeInTheDocument()
  })

  it.each(['online', 'away', 'none'] as const)('shows the initials in the %s state', (state) => {
    render(<Avatar playerId="p1" name="Mia" state={state} />)

    expect(screen.getByText('MI')).toBeInTheDocument()
  })

  it.each(['open', 'vacant'] as const)('shows no player in the %s state', (state) => {
    const { container } = render(
      <Avatar playerId="p1" name="Mia" image={IMAGE_URL} state={state} />
    )

    expect(screen.queryByText('MI')).not.toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })
})
