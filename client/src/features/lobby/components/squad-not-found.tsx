import { useTranslations } from 'next-intl'
import { Compass, Plus } from 'lucide-react'
import { Button } from '@/components/ds/button'
import { NoticeScreen } from '@/components/ds/notice-screen'

interface SquadNotFoundProps {
  code: string
}

/** The Lobby's not-found state, with the code the player tried as its mark. */
export function SquadNotFound({ code }: SquadNotFoundProps) {
  const t = useTranslations()

  return (
    <NoticeScreen
      eyebrow={t('squadNotFound.codeLabel')}
      mark={
        <span className="text-text-2 block font-mono text-[clamp(36px,9vw,64px)] leading-none font-bold tracking-[0.14em]">
          #{code}
        </span>
      }
      title={t('squadNotFound.title')}
      description={t('squadNotFound.description')}
    >
      <Button href="/squads" full icon={<Compass />} className="sm:w-auto">
        {t('squadNotFound.exploreSquads')}
      </Button>
      <Button
        href="/squads?create=1"
        variant="secondary"
        full
        icon={<Plus />}
        className="sm:w-auto"
      >
        {t('squadNotFound.createSquad')}
      </Button>
    </NoticeScreen>
  )
}
