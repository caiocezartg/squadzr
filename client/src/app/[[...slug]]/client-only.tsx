'use client'

import dynamic from 'next/dynamic'

// The app reads browser-only state (history, storage, the WebSocket), so it renders
// after hydration, as the Vite build did. Server-side rendering stays off for it.
const AppShell = dynamic(() => import('@/app-shell'), { ssr: false })

export function ClientOnly() {
  return <AppShell />
}
