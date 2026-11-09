import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import { ADMIN_GAMES_HREF } from './game-links'

interface GamePageHeaderProps {
  /** The game's name, or what the page holds instead of it (loading, not found). */
  readonly title: string
  /** The game's cover, before the title. */
  readonly cover?: ReactNode
  /** The game's badges, under the title. */
  readonly badges?: ReactNode
}

/**
 * The header of a game's page: the "Admin · Catalog" caption, the cover, the title with the game's
 * badges, and the way back to the Games list.
 */
export function GamePageHeader({ title, cover, badges }: GamePageHeaderProps) {
  const t = useTranslations('admin.catalog.games.detail')

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-end gap-4">
        {cover}
        <div className="flex min-w-0 flex-col">
          <p className="type-label text-muted">{t('caption')}</p>
          <h1 className="type-page-title text-[44px] break-words sm:text-[52px]">{title}</h1>
          {badges && <div className="mt-2 flex flex-wrap gap-2">{badges}</div>}
        </div>
      </div>
      <Button
        href={ADMIN_GAMES_HREF}
        variant="ghost"
        size="sm"
        icon={<ArrowLeft />}
        className="shadow-[inset_0_0_0_1px_var(--color-line)]"
      >
        {t('back')}
      </Button>
    </header>
  )
}
