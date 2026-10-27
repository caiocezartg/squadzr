/**
 * The copy feedback swap (CCC-111). Both faces stay in the layout so the button never changes width, and
 * both are hidden from assistive technology: the button's own name carries the state.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CopySwap } from './copy-swap'

function renderSwap(copied: boolean) {
  return render(<CopySwap copied={copied} idle={<span>#ABC123</span>} done={<span>Copied</span>} />)
}

describe('CopySwap', () => {
  it('shows the resting face and fades the confirmation out until the copy', () => {
    renderSwap(false)

    expect(screen.getByText('#ABC123').parentElement).not.toHaveClass('opacity-0')
    expect(screen.getByText('Copied').parentElement).toHaveClass('opacity-0', 'blur-[2px]')
  })

  it('crossfades to the confirmation once copied', () => {
    renderSwap(true)

    expect(screen.getByText('#ABC123').parentElement).toHaveClass('opacity-0', 'blur-[2px]')
    expect(screen.getByText('Copied').parentElement).not.toHaveClass('opacity-0')
  })

  it('keeps both faces in the layout and hides them from assistive technology', () => {
    const { container } = renderSwap(false)

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('#ABC123')).toBeInTheDocument()
    expect(screen.getByText('Copied')).toBeInTheDocument()
  })

  it('spaces the icon from the label, with the gap the caller picks', () => {
    const { rerender } = renderSwap(false)
    expect(screen.getByText('#ABC123').parentElement).toHaveClass('gap-2')

    rerender(
      <CopySwap
        copied={false}
        gap="gap-1.75"
        idle={<span>#ABC123</span>}
        done={<span>Copied</span>}
      />
    )
    expect(screen.getByText('#ABC123').parentElement).toHaveClass('gap-1.75')
  })
})
