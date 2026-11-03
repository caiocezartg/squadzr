/**
 * The slot meter (CCC-102). It is decorative: assistive technology skips it and the parent supplies
 * the count as text. Specs check the segments it draws.
 */

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SlotMeter, type SlotMeterVariant } from './slot-meter'

function drawn(container: HTMLElement) {
  const meter = container.firstElementChild!
  return {
    meter,
    segments: meter.children.length,
    lit: meter.querySelectorAll('[data-filled]').length,
  }
}

describe('SlotMeter', () => {
  it('is hidden from assistive technology', () => {
    const { container } = render(<SlotMeter filled={4} total={5} />)

    expect(drawn(container).meter).toHaveAttribute('aria-hidden', 'true')
  })

  it.each<SlotMeterVariant>(['blocks', 'line', 'pips'])(
    'draws one segment per slot and lights the filled ones in the %s variant',
    (variant) => {
      const { container } = render(<SlotMeter variant={variant} filled={4} total={5} />)

      expect(drawn(container)).toMatchObject({ segments: 5, lit: 4 })
    }
  )

  it('collapses more than ten slots into ten segments, each standing for several slots', () => {
    const { container, rerender } = render(<SlotMeter filled={10} total={20} />)
    expect(drawn(container)).toMatchObject({ segments: 10, lit: 5 })

    rerender(<SlotMeter filled={20} total={20} />)
    expect(drawn(container)).toMatchObject({ segments: 10, lit: 10 })

    rerender(<SlotMeter filled={1} total={40} />)
    expect(drawn(container)).toMatchObject({ segments: 10, lit: 0 })
  })

  it('draws ten segments for exactly ten slots', () => {
    const { container } = render(<SlotMeter filled={7} total={10} />)

    expect(drawn(container)).toMatchObject({ segments: 10, lit: 7 })
  })

  it('keeps the lit segments within the segments drawn', () => {
    const { container, rerender } = render(<SlotMeter filled={9} total={5} />)
    expect(drawn(container)).toMatchObject({ segments: 5, lit: 5 })

    rerender(<SlotMeter filled={-2} total={5} />)
    expect(drawn(container)).toMatchObject({ segments: 5, lit: 0 })
  })

  it.each(['mint', 'discord', 'amber'] as const)('lights segments in the %s tone', (tone) => {
    const { container } = render(<SlotMeter tone={tone} filled={2} total={5} />)

    expect(drawn(container)).toMatchObject({ segments: 5, lit: 2 })
  })
})
