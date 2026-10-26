import * as m from 'motion/react-m'
import { AppLink } from '@/components/layout/app-link'
import { useTranslations } from 'next-intl'
import { SearchX } from 'lucide-react'

interface SquadNotFoundProps {
  code: string
}

/** The Lobby's not-found state. Its motion components render under the Lobby's motion provider. */
export function SquadNotFound({ code }: SquadNotFoundProps) {
  const t = useTranslations()

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-24">
      <m.div
        className="flex flex-col items-center text-center max-w-md w-full"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        {/* Icon */}
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-accent/10 blur-2xl scale-150" />
          <div className="relative size-20 rounded-2xl bg-surface border border-accent/20 flex items-center justify-center shadow-[0_0_32px_rgba(0,255,162,0.08)]">
            <SearchX
              className="size-9 text-accent"
              strokeWidth={1.5}
              style={{ filter: 'drop-shadow(0 0 8px rgba(0,255,162,0.5))' }}
            />
          </div>
        </div>

        {/* Heading */}
        <h1 className="font-heading text-2xl font-bold text-offwhite sm:text-3xl mb-2">
          {t('squadNotFound.title')}
        </h1>

        {/* Description */}
        <p className="text-sm/relaxed text-muted mb-5">{t('squadNotFound.description')}</p>

        {/* Code badge */}
        <div className="card flex items-center gap-2.5 px-4 py-2.5 mb-8 border-border-light">
          <span className="text-xs text-muted">{t('squadNotFound.codeLabel')}</span>
          <span className="font-mono text-sm font-bold text-accent tracking-widest">{code}</span>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <AppLink href="/squads" className="btn-accent w-full sm:w-auto text-center">
            {t('squadNotFound.backToSquads')}
          </AppLink>
          <AppLink href="/squads" className="btn-ghost w-full sm:w-auto text-center">
            {t('squadNotFound.createSquad')}
          </AppLink>
        </div>
      </m.div>
    </div>
  )
}
