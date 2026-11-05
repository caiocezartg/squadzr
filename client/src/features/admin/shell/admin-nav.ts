import { FileText, LayoutDashboard, PanelsTopLeft, UserRound, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** A section of the panel, as the sidebar lists it. */
export interface AdminNavItem {
  readonly href: string
  /** The section's label, under `admin.nav`. */
  readonly label: 'overview' | 'squads' | 'users' | 'catalog' | 'audit'
  readonly icon: LucideIcon
}

/**
 * The panel's sections, in the sidebar's order (reference, Admin panel). A new section is one more item
 * here; the shell reads this list and needs no other change. The sidebar shows no counts.
 */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { href: '/admin', label: 'overview', icon: LayoutDashboard },
  { href: '/admin/squads', label: 'squads', icon: UsersRound },
  { href: '/admin/users', label: 'users', icon: UserRound },
  { href: '/admin/catalog', label: 'catalog', icon: PanelsTopLeft },
  { href: '/admin/audit', label: 'audit', icon: FileText },
]

/**
 * Whether `pathname` is inside the section at `href`. The overview is the panel's root, so it is
 * current only on its own path; any other section stays current on its sub-pages (a user's page).
 */
export function isCurrentSection(href: string, pathname: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}
