import { getTranslations } from 'next-intl/server'

/**
 * The landing's loading state, shown while the landing renders on the server. Its blocks take the
 * space of the hero and the games grid, so the page does not jump when the content arrives.
 */
export default async function LandingLoading() {
  const t = await getTranslations()

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex max-w-7xl flex-col items-center px-4 pt-20 pb-20 sm:px-6 sm:pt-28 lg:px-8"
    >
      <span className="sr-only">{t('common.loading')}</span>
      <div className="h-6 w-56 rounded-full bg-surface animate-pulse" />
      <div className="mt-6 h-16 w-full max-w-2xl rounded-xl bg-surface animate-pulse sm:h-24" />
      <div className="mt-6 h-5 w-full max-w-md rounded-md bg-surface animate-pulse" />
      <div className="mt-8 h-12 w-48 rounded-lg bg-surface animate-pulse" />
      <div className="mt-24 grid w-full grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="aspect-3/4 rounded-xl bg-surface animate-pulse" />
        ))}
      </div>
    </div>
  )
}
