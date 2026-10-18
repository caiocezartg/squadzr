import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { LOCALE_COOKIE, type Locale } from '@/i18n/locales'

const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

function writeLocaleCookie(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`
}

export function LanguageToggle() {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const isEN = locale === 'en'

  const switchTo = (next: Locale) => {
    if (locale === next) return
    writeLocaleCookie(next)
    // The refresh re-renders the root layout, which reads the new cookie and sends its messages.
    router.refresh()
  }

  return (
    <div
      className="relative flex items-center rounded-lg bg-surface border border-border p-0.5 font-heading"
      role="radiogroup"
      aria-label={t('common.language')}
    >
      {/* Sliding highlight */}
      <div
        className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md bg-accent/15 border border-accent/30 shadow-[0_0_8px_rgba(0,255,162,0.1)] transition-all duration-300 ease-out"
        style={{ left: isEN ? '2px' : 'calc(50% + 0px)' }}
      />

      <button
        type="button"
        role="radio"
        aria-checked={isEN}
        onClick={() => switchTo('en')}
        className={`relative z-10 rounded-md px-3 py-1 text-xs font-bold tracking-wide transition-colors duration-200 ${
          isEN ? 'text-accent' : 'text-muted hover:text-muted-light'
        }`}
      >
        EN
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={!isEN}
        onClick={() => switchTo('pt-BR')}
        className={`relative z-10 rounded-md px-3 py-1 text-xs font-bold tracking-wide transition-colors duration-200 ${
          !isEN ? 'text-accent' : 'text-muted hover:text-muted-light'
        }`}
      >
        PT
      </button>
    </div>
  )
}
