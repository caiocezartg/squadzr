import { useTranslation } from 'react-i18next'
import { useGames } from '@/features/games'

/**
 * The games-supported badge. It owns the game query so the hero does not have
 * to: on a cold landing load the badge chunk (and the shared API contract
 * runtime it needs) arrives after the hero copy is on screen.
 */
export function HeroGameBadge() {
  const { t } = useTranslation()
  const { games } = useGames()

  if (games.length === 0) return null

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-accent/5 border border-accent/15 px-4 py-1.5 text-xs font-semibold text-accent mb-2">
      <span className="size-1.5 rounded-full bg-accent animate-pulse" />
      {t('hero.badge', { count: games.length })}
    </span>
  )
}
