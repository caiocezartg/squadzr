import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { AdminShell } from '@/features/admin'
import { requireAdminSession } from '@/lib/server/admin-gate'
import { adminMetadata } from '@/lib/server/admin-metadata'

// Every admin page inherits this: the panel stays out of search engines. A page's title reads
// "Audit · Admin · Squadzr"; the overview, which sets none, takes the default, which the root template
// turns into "Admin · Squadzr". The template replaces the root one below this layout, so it spells the
// app name out.
const ADMIN_METADATA: Metadata = {
  title: { default: 'Admin', template: '%s · Admin · Squadzr' },
  robots: { index: false, follow: false },
}

/** The panel's metadata for an admin; anyone else's not-found page gets the not-found head. */
export function generateMetadata(): Promise<Metadata> {
  return adminMetadata(ADMIN_METADATA)
}

/**
 * The layout of the admin panel. The gate runs first and fails closed: anyone who is not a moderator, an admin or the owner,
 * and any request whose session cannot be read, gets the app's not-found page, so the panel's existence is
 * never revealed. Panel roles get the panel's own shell, which stays mounted while they move between
 * sections. The root layout's providers (session, language, query client) are inherited.
 */
export default async function AdminLayout({ children }: { readonly children: ReactNode }) {
  await requireAdminSession()

  return <AdminShell>{children}</AdminShell>
}
