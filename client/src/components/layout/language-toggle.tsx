'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Segmented } from '@/components/ds/segmented'
import { LOCALE_COOKIE, type Locale } from '@/i18n/locales'

const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

const LANGUAGE_OPTIONS = [
  { value: 'pt-BR', label: 'PT' },
  { value: 'en', label: 'EN' },
] as const satisfies readonly { value: Locale; label: string }[]

function writeLocaleCookie(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`
}

interface LanguageToggleProps {
  /** Stretches the switch to its container, as the sidebar wants; the landing nav keeps it compact. */
  readonly fluid?: boolean
  /** Drops the switch's ground, so only the pressed language's mint marks it, as the landing nav wants. */
  readonly bare?: boolean
}

/** The language switch: it writes the locale cookie the server reads, then refreshes the route. */
export function LanguageToggle({ fluid = true, bare = false }: LanguageToggleProps) {
  const t = useTranslations()
  const locale: Locale = useLocale() === 'pt-BR' ? 'pt-BR' : 'en'
  const router = useRouter()

  const switchTo = (next: Locale) => {
    if (locale === next) return
    writeLocaleCookie(next)
    // The refresh re-renders the root layout, which reads the new cookie and sends its messages.
    router.refresh()
  }

  return (
    <Segmented
      size="sm"
      fluid={fluid}
      className={bare ? 'bg-transparent p-0' : undefined}
      label={t('common.language')}
      options={LANGUAGE_OPTIONS}
      value={locale}
      onChange={switchTo}
    />
  )
}
