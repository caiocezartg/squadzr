/**
 * Regression test for the RoomCard entrance animation (CCC-40 r4).
 *
 * The card fades in with motion (`initial`/`animate` opacity, WAAPI). The CSS
 * transition on the same element must not include `opacity`: when the WAAPI
 * animation finishes, motion cancels it and the computed opacity briefly
 * falls back to the initial inline value, so a CSS transition would replay the
 * fade 300 ms after the 500 ms entrance. Hover (transform, border, shadow) and
 * the disabled `grayscale` keep their transitions.
 */

import { render, screen } from '@testing-library/react'
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
})
