/** The address of a person's page in the panel. */
export function adminUserHref(id: string): string {
  return `/admin/users/${encodeURIComponent(id)}`
}

/** The list of every user. */
export const ADMIN_USERS_HREF = '/admin/users'
