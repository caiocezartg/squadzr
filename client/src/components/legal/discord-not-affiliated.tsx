import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/** The notice that Squadzr is not affiliated with, endorsed by or sponsored by Discord. */
export function DiscordNotAffiliated({ className }: { readonly className?: string }) {
  const t = useTranslations('legal')

  return <p className={cn('text-muted text-xs leading-snug', className)}>{t('notAffiliated')}</p>
}
