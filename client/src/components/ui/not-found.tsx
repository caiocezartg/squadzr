import { useTranslations } from 'next-intl'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ds/button'
import { NoticeScreen } from '@/components/ds/notice-screen'

/** The App Router's not-found content. It has no motion, so it is visible in the server HTML as is. */
export function NotFound() {
  const t = useTranslations()

  return (
    <NoticeScreen
      icon={<Compass strokeWidth={2.2} />}
      title={t('notFound.title')}
      description={t('notFound.description')}
    >
      <div className="mt-5 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button href="/" full className="sm:w-auto">
          {t('notFound.backToHome')}
        </Button>
        <Button href="/squads" variant="secondary" full className="sm:w-auto">
          {t('notFound.exploreSquads')}
        </Button>
      </div>
    </NoticeScreen>
  )
}
