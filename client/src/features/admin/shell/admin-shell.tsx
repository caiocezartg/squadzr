'use client'

import type { ReactNode } from 'react'
import { PlayerProfileLauncher } from '@/features/player-profile'
import { AdminSidebar } from './admin-sidebar'
import { AdminTopBar } from './admin-top-bar'

/**
 * The shell of the admin panel (reference, Admin panel), apart from the app shell: at 1024px and up the
 * 232px admin sidebar beside the page; below that the top bar, with the sidebar as its drawer. It stays
 * mounted while the admin moves between sections. The page takes the Squad Board's width: centred, at
 * most `max-w-7xl`, with the same side spacing. The profile launcher serves "My profile" in the
 * account menu, as it does in the app.
 */
export function AdminShell({ children }: { readonly children: ReactNode }) {
  return (
    <PlayerProfileLauncher>
      <div className="bg-bg min-h-screen">
        <AdminSidebar />
        <div className="lg:pl-58">
          <AdminTopBar />
          <main className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-4.5 px-4 pt-6 pb-12 sm:px-6 lg:px-10 lg:pt-7.5 lg:pb-10">
            {children}
          </main>
        </div>
      </div>
    </PlayerProfileLauncher>
  )
}
