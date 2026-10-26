'use client'

import type { ReactNode } from 'react'
import { CreateSquadLauncher } from './create-squad-launcher'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'

/**
 * The shell of the app pages (reference, Responsive). At 1024px and up it is the 260px sidebar column
 * beside the page; below that it is the top bar, with the sidebar as its drawer. The launcher owns the
 * create-Squad dialog, so "Create squad" opens it the same way on every page.
 */
export function AppShell({ children }: { readonly children: ReactNode }) {
  return (
    <CreateSquadLauncher>
      <div id="root" className="bg-bg min-h-screen">
        <Sidebar />
        <div className="lg:pl-[260px]">
          <TopBar />
          <main>{children}</main>
        </div>
      </div>
    </CreateSquadLauncher>
  )
}
