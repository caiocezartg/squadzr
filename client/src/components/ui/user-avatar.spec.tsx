/**
 * The shared avatar (CCC-76). The image shows while it loads; a missing URL, a failed load and an
 * image that failed before the browser attached its handler all show the player's initial.
 */

import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserAvatar } from './user-avatar'

const AVATAR_URL = 'https://cdn.discordapp.com/avatars/1/avatar.png'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('UserAvatar', () => {
  it('shows the initial of the name when there is no image', () => {
    render(<UserAvatar name="caio" image={null} />)

    expect(screen.getByText('C')).toBeInTheDocument()
  })

  it('shows the image while it loads, not the initial', () => {
    const { container } = render(<UserAvatar name="Caio" image={AVATAR_URL} />)

    expect(container.querySelector('img')).not.toBeNull()
    expect(screen.queryByText('C')).not.toBeInTheDocument()
  })

  it('shows the initial when the image failed before React attached its error handler', () => {
    // A failed image reports itself complete with no natural size; jsdom loads nothing, so the
    // state is set here.
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true)

    render(<UserAvatar name="Caio" image={AVATAR_URL} />)

    expect(screen.getByText('C')).toBeInTheDocument()
  })
})
