import type { Metadata } from 'next'
import { NotFound } from '@/components/ui/not-found'

// The root layout's title template adds the app name.
export const metadata: Metadata = {
  title: 'Page not found',
}

/** Unknown URLs render this page, with its content in the server HTML. */
export default function NotFoundPage() {
  return <NotFound />
}
