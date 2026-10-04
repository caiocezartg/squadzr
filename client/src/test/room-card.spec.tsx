/**
 * Regression tests for the RoomCard entrance (CCC-40 r4/r5).
 *
 * The card fades in with motion (`initial`/`animate` opacity, WAAPI). Two
 * properties are load-bearing:
 *
 * - the CSS transition on the same element must not include `opacity`: when
 *   the WAAPI animation finishes, motion cancels it and the computed opacity
 *   briefly falls back to the initial inline value, so a CSS transition would
 *   replay the fade 300 ms after the 500 ms entrance;
 * - the fade only starts after the cover image is decoded: the image is part
 *   of the card from its first painted frame instead of popping in after the
 *   fade when the request resolves late.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RoomCard } from '@/components/rooms/room-card'
import { gameLol, openRoom } from './fixtures'

describe('room card — entrance animation', () => {
  it('keeps opacity out of the CSS transition properties', () => {
    render(<RoomCard room={openRoom} game={gameLol} />)

    const card = screen.getByRole('button')
    expect(card.className).not.toMatch(/(^|\s)transition-all(\s|$)/)

    const transitionProperty = card.className.match(/(?:^|\s)transition-\[([^\]]+)\]/)
    expect(transitionProperty).not.toBeNull()

    const properties = transitionProperty?.[1]?.split(',').map((property) => property.trim())
    expect(properties).toEqual(
      expect.arrayContaining(['transform', 'border-color', 'box-shadow', 'filter'])
    )
    expect(properties).not.toContain('opacity')
  })

  it('waits for the cover before starting the entrance fade', async () => {
    render(<RoomCard room={openRoom} game={gameLol} />)

    const card = screen.getByRole('button')
    const cover = screen.getByRole('img')

    // While the cover loads the card stays at the initial opacity, so the
    // image cannot pop in after the fade.
    expect(card.style.opacity).toBe('0')

    fireEvent.load(cover)

    await waitFor(() => expect(Number(card.style.opacity)).toBe(1), { timeout: 3_000 })
  })

  it('fades in immediately when the room has no game', async () => {
    render(<RoomCard room={openRoom} game={undefined} />)

    await waitFor(() => expect(Number(screen.getByRole('button').style.opacity)).toBe(1), {
      timeout: 3_000,
    })
  })
})
