import { lazy, Suspense } from 'react'
import { createRootRoute, lazyRouteComponent, Outlet, useMatches } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { AppHeader } from '@/components/layout/app-header'
import { LazyIslandBoundary } from '@/components/ui/lazy-island-boundary'

// Toasts are a non-essential capability: the library and its shared chunk load
// after the first paint instead of blocking the initial route.
const LazyToaster = lazy(() =>
  import('@/lib/toast-runtime').then((module) => ({ default: module.AppToaster }))
)

export const Route = createRootRoute({
  component: RootLayout,
  // The 404 view follows the same rule: its chunk (and the animation runtime it
  // shares with the landing page) stays out of the entry.
  notFoundComponent: lazyRouteComponent(() => import('@/components/ui/not-found'), 'NotFound'),
})

function RootLayout() {
  const { t } = useTranslation()
  const matches = useMatches()
  const isLanding = matches.length > 0 && matches[matches.length - 1]?.fullPath === '/'

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />

      <main className="flex-1">
        <Outlet />
      </main>

      {!isLanding && (
        <footer className="border-t border-border/50 py-6">
          <div className="mx-auto max-w-7xl px-4 text-center text-xs text-muted sm:px-6 lg:px-8">
            Squadzr &mdash; {t('footer.tagline')}
          </div>
        </footer>
      )}

      <LazyIslandBoundary>
        <Suspense fallback={null}>
          <LazyToaster theme="dark" position="top-center" richColors />
        </Suspense>
      </LazyIslandBoundary>
    </div>
  )
}
