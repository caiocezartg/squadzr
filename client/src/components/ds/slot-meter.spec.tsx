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

  it('caps a bigger Squad at five segments with a proportional fill', () => {
    const { container, rerender } = render(<SlotMeter filled={31} total={40} />)
    expect(drawn(container)).toMatchObject({ segments: 5, lit: 4 })

    rerender(<SlotMeter filled={1} total={40} />)
    expect(drawn(container)).toMatchObject({ segments: 5, lit: 1 })

    rerender(<SlotMeter filled={39} total={40} />)
    expect(drawn(container)).toMatchObject({ segments: 5, lit: 4 })

    rerender(<SlotMeter filled={40} total={40} />)
    expect(drawn(container)).toMatchObject({ segments: 5, lit: 5 })
  })

  it('draws every blocks segment at the same width whatever the Squad size', () => {
    const small = render(<SlotMeter filled={2} total={5} />)
    const big = render(<SlotMeter filled={2} total={40} />)

    expect(small.container.querySelector('span > span')!.className).toContain('w-10')
    expect(big.container.querySelector('span > span')!.className).toContain('w-10')
    expect(big.container.querySelector('span > span')!.className).not.toContain('w-4.5')
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
