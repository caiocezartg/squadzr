import type { Metadata } from 'next'
import { AdminCatalogPage } from '@/features/admin/page'
import { requireFullAdminSession } from '@/lib/server/admin-gate'
import { adminMetadata } from '@/lib/server/admin-metadata'

// The admin layout's title template adds the panel and app names; a viewer who is not an admin or the
// owner (a moderator included) gets the not-found head instead.
export function generateMetadata(): Promise<Metadata> {
  return adminMetadata({ title: 'Catalog' }, 'full')
}

/** Catalog Import is admin-only: a moderator passes the layout's gate and is stopped here with not-found. */
export default async function AdminCatalogRoute() {
  await requireFullAdminSession()
  return <AdminCatalogPage />
}
