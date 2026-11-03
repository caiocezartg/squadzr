/**
 * The shared tag (CCC-102). The read-only variants are text and the interactive ones are buttons with
 * their state in the accessibility tree: a toggle is pressed or not, a removable tag names what it
 * removes.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Tag } from './tag'

describe('Tag', () => {
  it.each(['tag', 'glass'] as const)(
    'shows the %s variant as #label text, not a control',
    (variant) => {
      render(<Tag variant={variant} label="ranked" />)

      expect(screen.getByText('#ranked')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    }
  )

  it.each(['lang', 'lang-light'] as const)(
    'shows the %s variant as the language, with the globe out of the accessibility tree',
    (variant) => {
      render(<Tag variant={variant} label="PT-BR" />)

      expect(screen.getByText('PT-BR')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
    }
  )

  it('shows a tag without a variant as a #label', () => {
    render(<Tag label="casual" />)

    expect(screen.getByText('#casual')).toBeInTheDocument()
  })

  it('exposes a toggle as a button whose pressed state follows the prop', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const { rerender } = render(
      <Tag variant="toggle" label="ranked" pressed={false} onClick={onClick} />
    )

    const off = screen.getByRole('button', { name: '#ranked' })
    expect(off).toHaveAttribute('aria-pressed', 'false')
    await user.click(off)
    expect(onClick).toHaveBeenCalledOnce()

    rerender(<Tag variant="toggle" label="ranked" pressed onClick={onClick} />)
    expect(screen.getByRole('button', { name: '#ranked' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows a suggestion as "+ #label" and reports a click', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Tag variant="suggest" label="casual" onClick={onClick} />)

    const suggestion = screen.getByRole('button', { name: '+ #casual' })
    expect(suggestion).not.toHaveAttribute('aria-pressed')
    await user.click(suggestion)

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('names a removable tag by what it removes, and reports a click', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Tag variant="removable" label="ranked" onClick={onClick} />)

    await user.click(screen.getByRole('button', { name: 'Remove ranked' }))

    expect(onClick).toHaveBeenCalledOnce()
  })
})
