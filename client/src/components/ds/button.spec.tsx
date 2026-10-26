/**
 * The shared button (CCC-102). Specs read the accessible name, role and state: a label names the
 * button, an icon-only square needs its own name, a disabled button does nothing, and a button that
 * navigates is a link.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Copy } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { Button, type ButtonVariant } from './button'

const VARIANTS: readonly ButtonVariant[] = [
  'primary',
  'secondary',
  'ghost',
  'link',
  'danger',
  'discord',
  'light',
  'dark',
  'glass',
]

describe('Button', () => {
  it.each(VARIANTS)('renders the %s variant as a button named by its label', (variant) => {
    render(<Button variant={variant}>Create squad</Button>)

    expect(screen.getByRole('button', { name: 'Create squad' })).toBeEnabled()
  })

  it('is a plain button, not a submit, unless asked', () => {
    render(<Button>Save</Button>)

    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button')
  })

  it('calls onClick when pressed', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Join</Button>)

    await user.click(screen.getByRole('button', { name: 'Join' }))

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('keeps the icon out of the accessible name, at either end', () => {
    const { rerender } = render(<Button icon={<Copy data-testid="icon" />}>Copy link</Button>)
    expect(screen.getByRole('button', { name: 'Copy link' })).toContainElement(
      screen.getByTestId('icon')
    )

    rerender(
      <Button icon={<Copy data-testid="icon" />} iconPosition="end">
        Copy link
      </Button>
    )
    expect(screen.getByRole('button', { name: 'Copy link' })).toContainElement(
      screen.getByTestId('icon')
    )
  })

  it('names an icon-only button by its aria-label', () => {
    render(<Button icon={<Copy />} aria-label="Copy squad link" />)

    expect(screen.getByRole('button', { name: 'Copy squad link' })).toBeInTheDocument()
  })

  it('does nothing while disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Join
      </Button>
    )

    const button = screen.getByRole('button', { name: 'Join' })
    await user.click(button)

    expect(button).toBeDisabled()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders a link to an app path when it has an href', () => {
    render(<Button href="/squads">Explore squads</Button>)

    expect(screen.getByRole('link', { name: 'Explore squads' })).toHaveAttribute('href', '/squads')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders a plain link, with its target and rel, for an address outside the app', () => {
    render(
      <Button variant="discord" href="https://discord.gg/abc" target="_blank" rel="noreferrer">
        Open in Discord
      </Button>
    )

    const link = screen.getByRole('link', { name: 'Open in Discord' })
    expect(link).toHaveAttribute('href', 'https://discord.gg/abc')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })

  it('names an icon-only link by its aria-label', () => {
    render(<Button href="/squads" icon={<Copy />} aria-label="Back to squads" />)

    expect(screen.getByRole('link', { name: 'Back to squads' })).toHaveAttribute('href', '/squads')
  })

  it('announces a disabled link as disabled, with no destination and no click', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button href="/squads" disabled onClick={onClick}>
        Explore squads
      </Button>
    )

    const link = screen.getByRole('link', { name: 'Explore squads' })
    await user.click(link)

    expect(link).toHaveAttribute('aria-disabled', 'true')
    expect(link).not.toHaveAttribute('href')
    expect(onClick).not.toHaveBeenCalled()
  })
})
