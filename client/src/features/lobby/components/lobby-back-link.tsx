import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'

/** The Lobby's way back to the Squad Board, shown when the viewer lost their place in the Squad. */
export function LobbyBackLink() {
  const t = useTranslations()

  return (
    <Button href="/squads" variant="secondary" size="sm" icon={<ArrowLeft />} className="w-fit">
      {t('lobby.backToSquads')}
    </Button>
  )
}
