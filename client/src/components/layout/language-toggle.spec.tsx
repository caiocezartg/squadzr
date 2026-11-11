/**
 * The language toggle writes the locale cookie that the server reads, then refreshes the route so the
 * server renders the page in the chosen language.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LOCALE_COOKIE } from '@/i18n/locales'
import { createHarnessNavigation } from '@/test/navigation'
import { LanguageToggle } from './language-toggle'

function readLocaleCookie(): string | undefined {
  const entry = document.cookie.split('; ').find((cookie) => cookie.startsWith(`${LOCALE_COOKIE}=`))
  return entry?.slice(LOCALE_COOKIE.length + 1)
}

afterEach(() => {
  document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0`
})

describe('LanguageToggle', () => {
  it('writes the chosen locale to the cookie and refreshes the route', async () => {
    const navigation = createHarnessNavigation('/squads')
    const user = userEvent.setup({ delay: null })
    render(<LanguageToggle />)

    await user.click(screen.getByRole('button', { name: 'PT' }))

    expect(readLocaleCookie()).toBe('pt-BR')
    expect(navigation.calls).toEqual([{ method: 'refresh' }])
  })

  it('does nothing when the current language is chosen again', async () => {
    const navigation = createHarnessNavigation('/squads')
    const user = userEvent.setup({ delay: null })
    render(<LanguageToggle />)

    await user.click(screen.getByRole('button', { name: 'EN' }))

    expect(readLocaleCookie()).toBeUndefined()
    expect(navigation.calls).toEqual([])
  })

  it('presses the current language, in the order of the sidebar artboard', () => {
    render(<LanguageToggle />)

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['PT', 'EN'])
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'PT' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('fills the sidebar column, PT and EN sharing the width', () => {
    render(<LanguageToggle />)

    expect(screen.getByRole('group', { name: 'Language' })).toHaveClass('flex', 'w-full')
    expect(screen.getByRole('button', { name: 'PT' })).toHaveClass('flex-1')
    expect(screen.getByRole('button', { name: 'EN' })).toHaveClass('flex-1')
  })

  it('names the group in the active language', () => {
    render(<LanguageToggle />)

    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument()
  })
})
