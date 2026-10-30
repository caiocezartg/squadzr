import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'

/** The way back keeps its label until the row runs out of room, so the actions stay on one line. */
const ICON_ON_TIGHT = '@max-[24rem]:size-11 @max-[24rem]:px-0'

/**
 * The Lobby's way back to the Squad Board, first in the header actions of every view. It sits in a
 * container-query row, which shrinks it to the icon alone when the row is tight.
 */
export function ExploreSquadsButton() {
  const t = useTranslations('ds.lobby')

  return (
    <Button
      variant="secondary"
      href="/squads"
      aria-label={t('exploreSquads')}
      className={ICON_ON_TIGHT}
      icon={<ArrowLeft />}
    >
      <span className="@max-[24rem]:hidden">{t('exploreSquads')}</span>
    </Button>
  )
}
