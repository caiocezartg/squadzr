import { lazy, Suspense } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { HeroSection } from '@/components/landing/hero-section'
import { HowItWorks } from '@/components/landing/how-it-works'
import { CTABanner } from '@/components/landing/cta-banner'

// Below-the-fold sections that pull extra runtimes (the games API and the
// accordion primitives) load after the hero instead of joining the first load.
const LazyPopularGames = lazy(() =>
  import('@/components/landing/popular-games').then((module) => ({
    default: module.PopularGames,
  }))
)
const LazyFAQSection = lazy(() =>
  import('@/components/landing/faq-section').then((module) => ({
    default: module.FAQSection,
  }))
)

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <>
      <HeroSection />
      <Suspense fallback={null}>
        <LazyPopularGames />
      </Suspense>
      <HowItWorks />
      <Suspense fallback={null}>
        <LazyFAQSection />
      </Suspense>
      <CTABanner />

      {/* Footer for landing page */}
      <footer className="border-t border-border/50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="font-heading text-sm font-bold text-muted">Squadzr</span>
            <p className="text-xs text-muted/60">
              &copy; {new Date().getFullYear()} Squadzr. Built for gamers.
            </p>
          </div>
        </div>
      </footer>
    </>
  )
}
