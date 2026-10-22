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

    await user.click(screen.getByRole('radio', { name: 'PT' }))

    expect(readLocaleCookie()).toBe('pt-BR')
    expect(navigation.calls).toEqual([{ method: 'refresh' }])
  })

  it('does nothing when the current language is chosen again', async () => {
    const navigation = createHarnessNavigation('/squads')
    const user = userEvent.setup({ delay: null })
    render(<LanguageToggle />)

    await user.click(screen.getByRole('radio', { name: 'EN' }))

    expect(readLocaleCookie()).toBeUndefined()
    expect(navigation.calls).toEqual([])
  })

  it('names the group in the active language', () => {
    render(<LanguageToggle />)

    expect(screen.getByRole('radiogroup', { name: 'Language' })).toBeInTheDocument()
  })
})
