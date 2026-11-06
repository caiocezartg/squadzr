import { FileText, LayoutDashboard, PanelsTopLeft, UserRound, UsersRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { canAccessAdminPanel, hasFullAdminAccess } from '@squadzr/schemas'

/**
 * Who opens a section: `panel` is every role that opens the panel (moderator, admin, owner); `full` is
 * an admin or the owner only.
 */
export type AdminNavAccess = 'panel' | 'full'

/** A section of the panel, as the sidebar lists it. */
export interface AdminNavItem {
  readonly href: string
  /** The section's label, under `admin.nav`. */
  readonly label: 'overview' | 'squads' | 'users' | 'catalog' | 'audit'
  readonly icon: LucideIcon
  readonly access: AdminNavAccess
}

/**
 * The panel's sections, in the sidebar's order (reference, Admin panel). A new section is one more item
 * here; the shell reads this list and needs no other change. The sidebar shows no counts, and only
 * the sections the viewer opens.
 */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { href: '/admin', label: 'overview', icon: LayoutDashboard, access: 'panel' },
  { href: '/admin/squads', label: 'squads', icon: UsersRound, access: 'panel' },
  { href: '/admin/users', label: 'users', icon: UserRound, access: 'panel' },
  { href: '/admin/catalog', label: 'catalog', icon: PanelsTopLeft, access: 'full' },
  { href: '/admin/audit', label: 'audit', icon: FileText, access: 'full' },
]

/** Whether a viewer with `role` opens a section of `access`. */
export function canOpenSection(access: AdminNavAccess, role: string | null | undefined): boolean {
  return access === 'full' ? hasFullAdminAccess(role) : canAccessAdminPanel(role)
}

/** The sections the viewer with `role` opens, in the sidebar's order. */
export function adminNavFor(role: string | null | undefined): readonly AdminNavItem[] {
  return ADMIN_NAV.filter((item) => canOpenSection(item.access, role))
}

/**
 * Whether `pathname` is inside the section at `href`. The overview is the panel's root, so it is
 * current only on its own path; any other section stays current on its sub-pages (a user's page).
 */
export function isCurrentSection(href: string, pathname: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}
