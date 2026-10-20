'use client'

import * as m from 'motion/react-m'
import { Search } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { AppLink } from '@/components/layout/app-link'
import { DiscordIcon } from '@/components/ui/icons'
import { useSession } from '@/hooks/use-session'
import { signInWithDiscord } from '@/lib/auth-client'
import { BackgroundRipple } from './background-ripple'
import { HeroGameBadge } from './hero-game-badge'
import { HeroSquadShowcase } from './hero-squad-showcase'

/**
 * The hero. Its badge, headline, copy and calls to action start visible, so the server HTML shows them
 * before any script runs. Only decoration animates: the underline under the accent word, and the
 * floating squad cards.
 */
export function HeroSection({ gameCount }: { readonly gameCount: number }) {
  const t = useTranslations()
  const lang = useLocale()
  const session = useSession()

  const handleSignIn = () => {
    signInWithDiscord('/squads')
  }

  return (
    <section className="relative overflow-hidden">
      <BackgroundRipple />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_50%,rgba(0,255,162,0.06),transparent_55%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_80%,rgba(88,101,242,0.04),transparent_50%)] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-20 sm:pt-28 sm:pb-24">
        <div className="max-w-full flex flex-col items-center">
          <HeroGameBadge count={gameCount} />

          <h1 className="font-heading text-5xl font-extrabold leading-[0.95] tracking-tight sm:leading-none sm:text-6xl lg:text-7xl xl:text-8xl">
            {t('hero.titleLine1')}
            <br />
            {t('hero.titleLine2')}&nbsp;
            <span className="relative text-accent">
              {t('hero.titleAccent')}
              <m.span
                className="absolute bottom-0 left-0 h-[3px] bg-accent/60 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 0.6, delay: 0.7, ease: 'easeOut' }}
              />
            </span>
          </h1>

          <p
            className={`mt-6 text-base text-muted leading-relaxed sm:text-lg sm:leading-7 ${lang === 'pt-BR' ? 'max-w-lg' : 'max-w-md'} text-center`}
          >
            {t.rich('hero.subtitle', {
              bold: (chunks) => <strong className="text-offwhite">{chunks}</strong>,
            })}
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-start gap-3">
            <AppLink
              href="/squads"
              className="btn-accent gap-2 text-base px-7 py-3 w-full md:w-auto"
            >
              <Search className="size-5" strokeWidth={2.5} />
              {t('hero.exploreSquads')}
            </AppLink>
            {!session?.user && (
              <button
                onClick={handleSignIn}
                className="btn-discord gap-2 text-base px-7 py-3 w-full md:w-auto"
              >
                <DiscordIcon className="size-5" />
                {t('hero.signInWithDiscord')}
              </button>
            )}
          </div>

          <div className="relative w-full max-w-5xl mt-12 -mb-8">
            <HeroSquadShowcase />
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-20 lg:h-32 bg-linear-to-t from-background to-transparent pointer-events-none" />
    </section>
  )
}
