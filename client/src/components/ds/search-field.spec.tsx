/**
 * The search field: a labelled input, a clear button once there is a value, and a combobox mode
 * that announces the list it controls.
 */

import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SearchField } from './search-field'

function Harness({ onClear }: { onClear?: () => void }) {
  const [value, setValue] = useState('')
  return <SearchField label="Search games" value={value} onChange={setValue} onClear={onClear} />
}

describe('search field', () => {
  it('is an input named by its label', () => {
    render(<SearchField label="Search games" value="" onChange={() => undefined} />)

    expect(screen.getByRole('searchbox', { name: 'Search games' })).toBeVisible()
  })

  it('reports what is typed', async () => {
    const user = userEvent.setup({ delay: null })
    const onChange = vi.fn()
    render(<SearchField label="Search games" value="" onChange={onChange} />)

    await user.type(screen.getByRole('searchbox', { name: 'Search games' }), 'v')

    expect(onChange.mock.calls).toEqual([['v']])
  })

  it('offers the clear button only with a value, and clearing empties the field and refocuses it', async () => {
    const user = userEvent.setup({ delay: null })
    const onClear = vi.fn()
    render(<Harness onClear={onClear} />)
    const input = screen.getByRole('searchbox', { name: 'Search games' })

    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()

    await user.type(input, 'valorant')
    expect(input).toHaveValue('valorant')

    await user.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
    expect(onClear).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
  })

  it('clears from the keyboard', async () => {
    const user = userEvent.setup({ delay: null })
    render(<Harness />)
    const input = screen.getByRole('searchbox', { name: 'Search games' })

    await user.type(input, 'dota')
    await user.tab()
    expect(screen.getByRole('button', { name: 'Clear search' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(input).toHaveValue('')
  })

  it('announces the list a combobox controls', () => {
    const { rerender } = render(
      <SearchField
        label="Search games"
        value="va"
        onChange={() => undefined}
        combobox={{ expanded: false, controls: 'games-list' }}
      />
    )

    const combobox = screen.getByRole('combobox', { name: 'Search games' })
    expect(combobox).toHaveAttribute('aria-expanded', 'false')
    expect(combobox).toHaveAttribute('aria-controls', 'games-list')
    expect(combobox).toHaveAttribute('aria-autocomplete', 'list')

    rerender(
      <SearchField
        label="Search games"
        value="va"
        onChange={() => undefined}
        combobox={{ expanded: true, controls: 'games-list' }}
      />
    )
    expect(screen.getByRole('combobox', { name: 'Search games' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  })
})
