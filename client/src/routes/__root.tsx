import { createRootRoute, lazyRouteComponent, Outlet, useMatches } from '@tanstack/react-router'
import { useTranslations } from 'next-intl'
import { Toaster } from 'sonner'
import { AppHeader } from '@/components/layout/app-header'

export const Route = createRootRoute({
  component: RootLayout,
  // The 404 view is a lazy chunk, so the entry does not carry its markup.
  notFoundComponent: lazyRouteComponent(() => import('@/components/ui/not-found'), 'NotFound'),
})

function RootLayout() {
  const t = useTranslations()
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
            {t('footer.line')}
          </div>
        </footer>
      )}

      {/* Eager, so an error toast shows on the first failure instead of waiting for a chunk. */}
      <Toaster theme="dark" position="top-center" richColors />
    </div>
  )
}
