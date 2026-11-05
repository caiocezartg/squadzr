/**
 * The admin panel's pages, for the App Router routes under `/admin`. Each section keeps its page in its
 * own folder, so a section grows without touching the others or the shell.
 */
export { AdminOverviewPage } from './overview/admin-overview-page'
export { AdminSquadsPage } from './squads/admin-squads-page'
export { AdminUsersPage } from './users/admin-users-page'
export { AdminCatalogPage } from './catalog/admin-catalog-page'
export { AdminAuditPage } from './audit/admin-audit-page'
export { auditPageFrom } from './audit/audit-query'
