import { createRootRoute, lazyRouteComponent, Outlet } from '@tanstack/react-router'

// The header, the footer and the toaster render in the Next root layout around this app, so the root
// route only renders its routes.
export const Route = createRootRoute({
  component: () => <Outlet />,
  // The 404 view is a lazy chunk, so the entry does not carry its markup.
  notFoundComponent: lazyRouteComponent(() => import('@/components/ui/not-found'), 'NotFound'),
})
