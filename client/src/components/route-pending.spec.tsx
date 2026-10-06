/**
 * The default route loading state (CCC-43): a fixed indeterminate progress bar
 * below the header, an empty block that keeps the footer in place, and a
 * screen-reader-only label — no visible loading text.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RoutePending } from './route-pending'

describe('RoutePending', () => {
  it('announces loading to assistive technology without visible loading text', () => {
    render(<RoutePending />)

    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('data-testid', 'route-pending')
    expect(status).toHaveAttribute('aria-live', 'polite')

    // The label is available to screen readers only; nothing else is rendered
    // as text.
    const label = screen.getByText('Loading…')
    expect(status).toContainElement(label)
    expect(label).toHaveClass('sr-only')
    expect(status.textContent).toBe('Loading…')

    // The progress bar itself is decorative and out of the layout flow.
    const bar = status.querySelector('[aria-hidden="true"]')
    expect(bar).not.toBeNull()
    expect(bar).toHaveClass('fixed')
  })
})
