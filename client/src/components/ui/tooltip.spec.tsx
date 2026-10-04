/**
 * The shared tooltip primitive. The trigger is a keyboard stop, the content is
 * the accessible description, hovering onto the content keeps it revealed
 * (WCAG 1.4.13 Hoverable) and Escape dismisses it from anywhere while shown.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Tooltip } from './tooltip'

describe('tooltip', () => {
  it('exposes the label to keyboard focus and dismisses with Escape', async () => {
    const user = userEvent.setup({ delay: null })
    render(
      <div>
        <Tooltip label="Online">
          <span />
        </Tooltip>
        <Tooltip label="Connected">
          <span />
        </Tooltip>
      </div>
    )

    // Each trigger is reachable with Tab and its tooltip is the accessible
    // description, so keyboard users get the same Online/Connected label.
    await user.tab()
    const presence = screen.getByText('Online').closest('[tabindex="0"]')
    expect(presence).toHaveFocus()
    expect(presence).toHaveAccessibleDescription('Online')

    await user.tab()
    const connection = screen.getByText('Connected').closest('[tabindex="0"]')
    expect(connection).toHaveFocus()
    expect(connection).toHaveAccessibleDescription('Connected')

    const connectionTooltip = screen.getByRole('tooltip', { name: 'Connected' })
    expect(connectionTooltip).toHaveClass('group-focus-visible:opacity-100')
    await user.keyboard('{Escape}')
    expect(connectionTooltip).not.toHaveClass('group-focus-visible:opacity-100')
  })

  it('stays revealed while the pointer is over the content and dismisses with Escape anywhere', async () => {
    const user = userEvent.setup({ delay: null })
    render(
      <Tooltip label="Online">
        <span data-testid="trigger" />
      </Tooltip>
    )

    const trigger = screen.getByTestId('trigger')
    const tooltip = screen.getByRole('tooltip')

    await user.hover(trigger)
    expect(tooltip).toHaveClass('group-hover:opacity-100')
    // The content is hoverable: it does not opt out of pointer events.
    expect(tooltip).not.toHaveClass('pointer-events-none')

    // Moving the pointer onto the tooltip itself must not dismiss it.
    await user.hover(tooltip)
    expect(tooltip).toHaveClass('group-hover:opacity-100')

    // Escape dismisses it while visible even though focus is not on the
    // trigger.
    await user.keyboard('{Escape}')
    expect(tooltip).not.toHaveClass('group-hover:opacity-100')

    // Leaving the indicator and hovering again reveals it once more.
    await user.unhover(tooltip)
    await user.hover(trigger)
    expect(tooltip).toHaveClass('group-hover:opacity-100')
  })
})
