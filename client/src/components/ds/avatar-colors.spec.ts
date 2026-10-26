/** The initials colours (CCC-102): a player's pair comes from their id and never changes. */

import { describe, expect, it } from 'vitest'
import { AVATAR_PALETTE, pickAvatarColors } from './avatar-colors'

describe('pickAvatarColors', () => {
  it('has the reference palette of seven pairs', () => {
    expect(AVATAR_PALETTE).toHaveLength(7)
    expect(AVATAR_PALETTE[0]).toEqual({ background: '#0E4D3A', foreground: '#B9FFE4' })
    expect(AVATAR_PALETTE[6]).toEqual({ background: '#1E4A4A', foreground: '#C6F4F4' })
  })

  it('gives the same id the same pair every time', () => {
    expect(pickAvatarColors('player-42')).toBe(pickAvatarColors('player-42'))
  })

  it('always picks a pair from the palette', () => {
    for (const id of ['', 'a', 'player-1', '8c9a1f0e-3b7d-4a52-9e61-0d2f4b6a8c10', '🎮']) {
      expect(AVATAR_PALETTE).toContain(pickAvatarColors(id))
    }
  })

  it('spreads different ids over the whole palette', () => {
    const picked = new Set(
      Array.from({ length: 100 }, (_, i) => pickAvatarColors(`player-${i}`).background)
    )

    expect(picked.size).toBe(AVATAR_PALETTE.length)
  })

  it('keeps a known id on its known pair, so players keep their colours between releases', () => {
    expect(pickAvatarColors('user-1')).toBe(AVATAR_PALETTE[3])
  })
})
