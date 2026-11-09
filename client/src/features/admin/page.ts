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
export { catalogPageFrom } from './catalog/catalog-query'
export { AdminUserPage } from './users/admin-user-page'
export { adminUsersParamsFrom } from './users/users-query'
export { overviewPeriodFrom } from './overview/overview-query'
export { adminSquadsParamsFrom } from './squads/squads-query'
export { AdminGamesPage } from './catalog/games/admin-games-page'
export { AdminGamePage } from './catalog/games/admin-game-page'
export { adminGamesParamsFrom } from './catalog/games/games-query'
