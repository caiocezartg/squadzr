import type { Metadata } from 'next'
import { AdminUsersPage } from '@/features/admin/page'
import { adminMetadata } from '@/lib/server/admin-metadata'

// The admin layout's title template adds the panel and app names; a viewer who is not an admin gets
// the not-found head instead.
export function generateMetadata(): Promise<Metadata> {
  return adminMetadata({ title: 'Users' })
}

export default function AdminUsersRoute() {
  return <AdminUsersPage />
}
