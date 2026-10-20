import * as m from 'motion/react-m'
import { useTranslations } from 'next-intl'
import { Compass } from 'lucide-react'
import { AppLink } from '@/components/layout/app-link'

export function NotFound() {
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
            <Compass
              className="size-9 text-accent"
              strokeWidth={1.5}
              style={{ filter: 'drop-shadow(0 0 8px rgba(0,255,162,0.5))' }}
            />
          </div>
        </div>

        {/* Heading */}
        <h1 className="font-heading text-2xl font-bold text-offwhite sm:text-3xl mb-2">
          {t('notFound.title')}
        </h1>

        {/* Description */}
        <p className="text-sm text-muted leading-relaxed mb-8">{t('notFound.description')}</p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <AppLink href="/" className="btn-accent w-full sm:w-auto text-center">
            {t('notFound.backToHome')}
          </AppLink>
          <AppLink href="/squads" className="btn-ghost w-full sm:w-auto text-center">
            {t('notFound.exploreRooms')}
          </AppLink>
        </div>
      </m.div>
    </div>
  )
}
