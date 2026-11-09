import 'server-only'

/**
 * The admin panel's server entry point, for the routes that read a page's data before rendering it.
 * It stays apart from the `page` entry, which carries client views.
 */
export { prefetchAuditEntriesAndWait } from './audit/prefetch-audit'
export { prefetchAdminUserAndWait, prefetchAdminUsersAndWait } from './users/prefetch-users'
export { prefetchAdminOverviewAndWait } from './overview/prefetch-overview'
export { prefetchAdminSquadsAndWait } from './squads/prefetch-squads'
export { prefetchCatalogImportRunsAndWait } from './catalog/prefetch-catalog'
