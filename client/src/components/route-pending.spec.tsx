/**
 * The default route loading state (CCC-43): a neutral, invisible placeholder
 * that keeps the footer in place and announces loading to assistive
 * technology. No visible loading text and no progress bar.
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
  })

  it('keeps layout space without rendering a progress bar', () => {
    render(<RoutePending />)

    const status = screen.getByRole('status')
    expect(status).toHaveClass('min-h-[50vh]')

    // The screen-reader label is the only child: no bar or other decoration.
    expect(status.children).toHaveLength(1)
    expect(status.querySelector('[aria-hidden="true"]')).toBeNull()
    expect(status.querySelector('.fixed')).toBeNull()
  })
})
