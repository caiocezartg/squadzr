import { useTranslations } from 'next-intl'
import { ArrowLeft, Compass } from 'lucide-react'
import { Button } from '@/components/ds/button'
import { NoticeScreen } from '@/components/ds/notice-screen'
import { AppLink } from '@/components/layout/app-link'

/** The App Router's not-found content. It has no motion, so it is visible in the server HTML as is. */
export function NotFound() {
  const t = useTranslations()

  return (
    <>
      <header className="px-4 pt-6 sm:px-8">
        <AppLink
          href="/"
          aria-label={t('ds.shell.home')}
          className="focus-visible:outline-mint block w-fit focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <img src="/squadzr-logo.svg" alt="" className="block w-26" />
        </AppLink>
      </header>
      <NoticeScreen
        eyebrow={t('notFound.eyebrow')}
        mark={
          <span aria-hidden="true" className="type-display text-text block">
            404
          </span>
        }
        title={t('notFound.title')}
        description={t('notFound.description')}
      >
        <Button href="/" full icon={<ArrowLeft />} className="sm:w-auto">
          {t('notFound.backToHome')}
        </Button>
        <Button href="/squads" variant="secondary" full icon={<Compass />} className="sm:w-auto">
          {t('notFound.exploreSquads')}
        </Button>
      </NoticeScreen>
    </>
  )
}
