import { useTranslations } from 'next-intl'
import { LayoutGrid, Plus } from 'lucide-react'
import { Button } from '@/components/ds/button'
import { NoticeScreen } from '@/components/ds/notice-screen'

/** A Squad code has 6 characters; a longer one from the URL is cut, so it cannot stretch the screen. */
const SQUAD_CODE_LENGTH = 6

/** The code as the mark shows it: at most a code's length, with an ellipsis when the URL had more. */
function displayedSquadCode(code: string): string {
  return code.length > SQUAD_CODE_LENGTH ? `${code.slice(0, SQUAD_CODE_LENGTH)}…` : code
}

interface SquadNotFoundProps {
  code: string
}

/** The Lobby's not-found state, with the code the player tried as its mark. */
export function SquadNotFound({ code }: SquadNotFoundProps) {
  const t = useTranslations()

  return (
    <NoticeScreen
      mark={
        <span className="text-text-2 block font-mono whitespace-nowrap text-[clamp(36px,9vw,64px)] leading-none font-bold tracking-[0.14em]">
          #{displayedSquadCode(code)}
        </span>
      }
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
