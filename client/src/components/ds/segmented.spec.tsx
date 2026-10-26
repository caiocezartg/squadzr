/**
 * The segmented control: a labelled group of toggle buttons, controlled by its parent, and
 * operable from the keyboard.
 */

import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Segmented } from './segmented'

const options = [
  { value: 'pt-BR', label: 'PT-BR' },
  { value: 'en-US', label: 'EN-US' },
] as const

function Harness({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState<'pt-BR' | 'en-US'>('pt-BR')
  return (
    <Segmented
      label="Language"
      options={options}
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

describe('segmented', () => {
  it('is a labelled group whose pressed button is the value', () => {
    render(
      <Segmented label="Language" options={options} value="en-US" onChange={() => undefined} />
    )

    const group = screen.getByRole('group', { name: 'Language' })
    expect(group).toContainElement(screen.getByRole('button', { name: 'PT-BR' }))
    expect(screen.getByRole('button', { name: 'PT-BR', pressed: false })).toBeVisible()
    expect(screen.getByRole('button', { name: 'EN-US', pressed: true })).toBeVisible()
  })

  it('leaves the value to its parent', async () => {
    const user = userEvent.setup({ delay: null })
    const onChange = vi.fn()
    render(<Segmented label="Language" options={options} value="pt-BR" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'EN-US' }))

    expect(onChange.mock.calls).toEqual([['en-US']])
    expect(screen.getByRole('button', { name: 'PT-BR' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'EN-US' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('moves with Tab and picks with Enter or Space', async () => {
    const user = userEvent.setup({ delay: null })
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.tab()
    expect(screen.getByRole('button', { name: 'PT-BR' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'EN-US' })).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'EN-US' })).toHaveAttribute('aria-pressed', 'true')

    await user.tab({ shift: true })
    await user.keyboard(' ')
    expect(screen.getByRole('button', { name: 'PT-BR' })).toHaveAttribute('aria-pressed', 'true')
    expect(onChange.mock.calls).toEqual([['en-US'], ['pt-BR']])
  })
})
