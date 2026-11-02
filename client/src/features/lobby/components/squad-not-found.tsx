import { useTranslations } from 'next-intl'
import { SearchX } from 'lucide-react'
import { Button } from '@/components/ds/button'
import { NoticeScreen } from '@/components/ds/notice-screen'

interface SquadNotFoundProps {
  code: string
}

/** The Lobby's not-found state, with the code the player tried. */
export function SquadNotFound({ code }: SquadNotFoundProps) {
  const t = useTranslations()

  return (
    <NoticeScreen
      icon={<SearchX strokeWidth={2.2} />}
      title={t('squadNotFound.title')}
      description={t('squadNotFound.description')}
    >
      <p className="bg-card mt-2 flex items-center gap-2.5 px-4 py-2.5">
        <span className="type-label text-muted">{t('squadNotFound.codeLabel')}</span>
        <span className="type-code text-mint text-[13px]">{code}</span>
      </p>
      <div className="mt-5 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button href="/squads" full className="sm:w-auto">
          {t('squadNotFound.backToSquads')}
        </Button>
        <Button href="/squads?create=1" variant="secondary" full className="sm:w-auto">
          {t('squadNotFound.createSquad')}
        </Button>
      </div>
    </NoticeScreen>
  )
}
