import { useTranslations } from 'next-intl'

/**
 * The games-supported badge. The count is the total of Listed Games from the landing's popular
 * games read, so the badge is part of the server HTML with the rest of the hero.
 */
export function HeroGameBadge({ count }: { readonly count: number }) {
  const t = useTranslations()

  if (count === 0) return null

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-accent/5 border border-accent/15 px-4 py-1.5 text-xs font-semibold text-accent mb-2">
      <span className="size-1.5 rounded-full bg-accent animate-pulse" />
      {t('hero.badge', { count })}
    </span>
  )
}
