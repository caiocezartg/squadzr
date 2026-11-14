import { LockKeyhole } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/**
 * The line beside a "Sign in with Discord" button: the password is typed on discord.com, never on
 * Squadzr. It answers the worry an account-theft site would exploit, at the moment of signing in.
 */
export function DiscordSignInNote({ className }: { readonly className?: string }) {
  const t = useTranslations('legal')

  return (
    <p className={cn('text-muted flex items-start gap-1.5 text-xs leading-snug', className)}>
      <LockKeyhole aria-hidden className="mt-px size-3.5 shrink-0" />
      {t('signInNote')}
    </p>
  )
}

/** The notice that Squadzr is not affiliated with, endorsed by or sponsored by Discord. */
export function DiscordNotAffiliated({ className }: { readonly className?: string }) {
  const t = useTranslations('legal')

  return <p className={cn('text-muted text-xs leading-snug', className)}>{t('notAffiliated')}</p>
}
