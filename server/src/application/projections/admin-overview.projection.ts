import type { ActivityResponse, OverviewResponse } from '@squadzr/schemas'
import type { GetAdminActivityOutput } from '@application/use-cases/admin/get-admin-activity.use-case'
import type { GetAdminOverviewOutput } from '@application/use-cases/admin/get-admin-overview.use-case'
import { toAuditEntryDto } from './audit-entry.projection'
import { toCatalogImportRunDto } from './catalog-import-run.projection'

export function toOverviewResponse(overview: GetAdminOverviewOutput): OverviewResponse {
  return {
    period: overview.period,
    live: overview.live,
    metrics: overview.metrics,
    recentAudit: overview.recentAudit?.map(toAuditEntryDto) ?? null,
    catalogImport: overview.catalogImport
      ? {
          lastRun: overview.catalogImport.lastRun
            ? toCatalogImportRunDto(overview.catalogImport.lastRun)
            : null,
        }
      : null,
  }
}

export function toActivityResponse(activity: GetAdminActivityOutput): ActivityResponse {
  return {
    metric: activity.metric,
    period: activity.period,
    rows: activity.rows.map((row) => ({ ...row })),
  }
}
