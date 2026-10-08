import { lazy, Suspense } from 'react'
import { Link } from '@tanstack/react-router'
import { signIn, useSession } from '@/lib/auth-client'
import * as motion from 'motion/react-client'
import { Search } from 'lucide-react'
import { DiscordIcon } from '@/components/ui/icons'
import { LazyIslandBoundary } from '@/components/ui/lazy-island-boundary'
import { useTranslation, Trans } from 'react-i18next'
import { BackgroundRipple } from './background-ripple'
import { HeroRoomShowcase } from './hero-room-showcase'

// The badge queries the games API; its chunk (and the shared API runtime)
// arrives after the hero copy instead of blocking the first paint.
const LazyHeroGameBadge = lazy(() =>
  import('./hero-game-badge').then((module) => ({ default: module.HeroGameBadge }))
)

export function HeroSection() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage || i18n.language
  const { data: session } = useSession()

  const handleSignIn = () => {
    signIn.social({
      provider: 'discord',
      callbackURL: window.location.origin + '/rooms',
    })
  }

  return (
    <section className="relative overflow-hidden">
      <BackgroundRipple />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_50%,rgba(0,255,162,0.06),transparent_55%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_80%,rgba(88,101,242,0.04),transparent_50%)] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-20 sm:pt-28 sm:pb-24">
        <div className="max-w-full flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <LazyIslandBoundary>
              <Suspense fallback={null}>
                <LazyHeroGameBadge />
              </Suspense>
            </LazyIslandBoundary>
          </motion.div>

          <motion.h1
            className="font-heading text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl xl:text-8xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {t('hero.titleLine1')}
            <br />
            {t('hero.titleLine2')}&nbsp;
            <span className="relative text-accent">
              {t('hero.titleAccent')}
              <motion.span
                className="absolute bottom-0 left-0 h-[3px] bg-accent/60 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 0.6, delay: 0.7, ease: 'easeOut' }}
              />
            </span>
          </motion.h1>

          <motion.p
            className={`mt-6 text-base text-muted leading-relaxed sm:text-lg ${lang === 'pt-BR' ? 'max-w-lg' : 'max-w-md'} text-center`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Trans
              i18nKey="hero.subtitle"
              components={{ bold: <strong className="text-offwhite" /> }}
            />
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="mt-8 flex flex-col sm:flex-row items-start gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
          >
            <Link
              to="/rooms"
              search={{}}
              className="btn-accent gap-2 text-base px-7 py-3 w-full md:w-auto"
            >
              <Search className="size-5" strokeWidth={2.5} />
              {t('hero.exploreRooms')}
            </Link>
            {!session?.user && (
              <button
                onClick={handleSignIn}
                className="btn-discord gap-2 text-base px-7 py-3 w-full md:w-auto"
              >
                <DiscordIcon className="size-5" />
                {t('hero.signInWithDiscord')}
              </button>
            )}
          </motion.div>

          <div className="relative w-full max-w-5xl mt-12 -mb-8">
            <HeroRoomShowcase />
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-20 lg:h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </section>
  )
}
