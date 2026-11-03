import { useTranslations } from 'next-intl'
import { LayoutGrid, Plus } from 'lucide-react'
import { Button } from '@/components/ds/button'
import { NoticeScreen } from '@/components/ds/notice-screen'
import { SquadCodeMark } from './squad-code-mark'

interface SquadNotFoundProps {
  code: string
}

/** The Lobby's not-found state, with the code the player tried as its mark. */
export function SquadNotFound({ code }: SquadNotFoundProps) {
  const t = useTranslations()

  return (
    <NoticeScreen
      mark={<SquadCodeMark code={code} />}
      title={t('squadNotFound.title')}
      description={t('squadNotFound.description')}
      // The shell's top bar is 3.5rem below 1024px; from there up the page has no bar above it.
      className="min-h-[calc(100dvh-3.5rem)] lg:min-h-dvh"
    >
      <Button href="/squads" full icon={<LayoutGrid />} className="sm:w-auto">
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
