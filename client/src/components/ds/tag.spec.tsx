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

  it.each(['platform', 'platform-light'] as const)(
    'shows the %s variant as an icon and the short label, not a control',
    (variant) => {
      const { container } = render(<Tag variant={variant} platform="ps5" label="PS5" />)

      expect(screen.getByText('PS5')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      expect(screen.queryByRole('img')).not.toBeInTheDocument()
      expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    }
  )

  it('wears the language chip tokens on the platform chip, with no colour of its own', () => {
    render(
      <>
        <Tag variant="lang" label="EN-US" />
        <Tag variant="platform" platform="pc" label="PC" />
        <Tag variant="lang-light" label="PT-BR" />
        <Tag variant="platform-light" platform="pc" label="PC light" />
      </>
    )

    expect(screen.getByText('PC').className).toContain(screen.getByText('EN-US').className)
    expect(screen.getByText('PC light').className).toContain(screen.getByText('PT-BR').className)
  })

  it.each([
    ['pc', 'windows'],
    ['ps5', 'playstation'],
    ['ps4', 'playstation'],
    ['xbox-series', 'xbox'],
    ['xbox-one', 'xbox'],
    ['switch-2', 'nintendo-switch'],
    ['switch', 'nintendo-switch'],
    ['mobile', 'phone'],
  ] as const)('draws the %s platform with the %s mark', (platform, mark) => {
    const { container } = render(<Tag variant="platform" platform={platform} label={platform} />)

    expect(container.querySelector('svg')).toHaveAttribute('data-mark', mark)
  })

  it('puts a decorative mark before the label of a toggle and a removable chip', () => {
    const mark = <svg data-testid="mark" aria-hidden="true" />
    render(
      <>
        <Tag variant="toggle" choice label="PS5" pressed={false} onClick={vi.fn()} icon={mark} />
        <Tag variant="removable" label="Xbox One" onClick={vi.fn()} icon={mark} />
      </>
    )

    expect(screen.getByRole('radio', { name: 'PS5' })).toContainElement(
      screen.getAllByTestId('mark')[0] ?? null
    )
    expect(screen.getByRole('button', { name: /Xbox One/ })).toContainElement(
      screen.getAllByTestId('mark')[1] ?? null
    )
  })

  it('exposes a single-choice toggle as a radio without the #', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const { rerender } = render(
      <Tag variant="toggle" choice label="PC" pressed={false} onClick={onClick} />
    )

    const off = screen.getByRole('radio', { name: 'PC' })
    expect(off).toHaveAttribute('aria-checked', 'false')
    expect(off).not.toHaveAttribute('aria-pressed')
    await user.click(off)
    expect(onClick).toHaveBeenCalledOnce()

    rerender(<Tag variant="toggle" choice label="PC" pressed onClick={onClick} />)
    expect(screen.getByRole('radio', { name: 'PC' })).toHaveAttribute('aria-checked', 'true')
  })

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
