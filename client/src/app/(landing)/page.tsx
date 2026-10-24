import type { Metadata } from 'next'
import { connection } from 'next/server'
import { CTABanner } from '@/components/landing/cta-banner'
import { FAQSection } from '@/components/landing/faq-section'
import { HeroSection } from '@/components/landing/hero-section'
import { HowItWorks } from '@/components/landing/how-it-works'
import { LandingFooter } from '@/components/landing/landing-footer'
import { PopularGames } from '@/components/landing/popular-games'
import { MotionProvider } from '@/components/ui/motion-provider'
import { loadPopularGames } from '@/lib/server/games'

// The root layout's title template does not reach a page at its own level, so the landing names the app itself.
export const metadata: Metadata = {
  title: 'Squadzr — Find your gaming squad',
}

/**
 * The landing. The games come from the server, and every section renders in the server HTML, so the
 * headline, copy and calls to action show before any script runs. The viewer's session reaches the
 * sections through the root layout's session provider, which the server seeds.
 */
export default async function LandingPage() {
  // The landing renders per request. Waiting for the request first keeps Next from rendering it at build
  // time, when the games API is not running.
  await connection()
  const { totalGames, games } = await loadPopularGames()

  return (
    <MotionProvider>
      <HeroSection gameCount={totalGames} />
      <PopularGames games={games} />
      <HowItWorks />
      <FAQSection />
      <CTABanner />
      <LandingFooter />
    </MotionProvider>
  )
}
