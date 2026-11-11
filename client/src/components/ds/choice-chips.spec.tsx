/**
 * The choice chips: a radiogroup of toggle chips, controlled by its parent, with one tab stop and
 * the arrow, Home and End keys moving the choice.
 */

import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ChoiceChips } from './choice-chips'

const options = [
  { value: 'pc', label: 'PC' },
  { value: 'ps5', label: 'PS5' },
  { value: 'switch', label: 'Switch' },
] as const

type Value = (typeof options)[number]['value']

function Harness({ invalid, describedBy }: { invalid?: boolean; describedBy?: string }) {
  const [value, setValue] = useState<Value | null>(null)
  return (
    <>
      <ChoiceChips
        label="Platform"
        options={options}
        value={value}
        onChange={setValue}
        invalid={invalid}
        describedBy={describedBy}
      />
      <p id="platform-error">Choose a platform</p>
    </>
  )
}

describe('ChoiceChips', () => {
  it('moves the choice to the last chip with End and back to the first with Home', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.tab()
    await user.keyboard('{End}')
    expect(screen.getByRole('radio', { name: 'Switch' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Switch' })).toHaveFocus()

    await user.keyboard('{Home}')
    expect(screen.getByRole('radio', { name: 'PC' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'PC' })).toHaveFocus()
  })

  it('marks the group invalid and points it at its error', () => {
    render(<Harness invalid describedBy="platform-error" />)

    const group = screen.getByRole('radiogroup', { name: 'Platform' })
    expect(group).toHaveAttribute('aria-invalid', 'true')
    expect(group).toHaveAccessibleDescription('Choose a platform')
  })

  it('leaves a valid group without invalid or description attributes', () => {
    render(<Harness />)

    const group = screen.getByRole('radiogroup', { name: 'Platform' })
    expect(group).not.toHaveAttribute('aria-invalid')
    expect(group).not.toHaveAttribute('aria-describedby')
  })
})
