import { hasFullAdminAccess, OVERVIEW_AUDIT_LIMIT, type OverviewPeriod } from '@squadzr/schemas'
import type { CatalogImportRun } from '@domain/entities/catalog-import-run.entity'
import type { AuditEntry } from '@domain/entities/audit-entry.entity'
import type { IAdminStatsRepository } from '@domain/repositories/admin-stats.repository'
import type { IAuditEntryRepository } from '@domain/repositories/audit-entry.repository'
import type { ICatalogImportRunRepository } from '@domain/repositories/catalog-import-run.repository'
import {
  peakPeriods,
  totalPeriods,
  type PeriodPeaks,
  type PeriodTotals,
} from '@domain/services/activity-period'
import type { Clock } from '@domain/services/clock.interface'
import type { OnlinePresence } from '@domain/services/online-presence.interface'
import type { IGetAdminActivityUseCase } from './get-admin-activity.use-case'

export interface GetAdminOverviewInput {
  readonly period: OverviewPeriod
  /** The viewer's role: only an admin or the owner reads the audit. */
  readonly viewerRole: string | null | undefined
}

export interface GetAdminOverviewOutput {
  readonly period: OverviewPeriod
  readonly live: {
    readonly onlineUsers: number
    readonly totalUsers: number
    readonly openSquads: number
    readonly completedSquads: number
  }
  readonly metrics: {
    readonly completed: PeriodTotals
    readonly signups: PeriodTotals
    /** The highest day of Activity Samples; null with none in the period. */
    readonly online: PeriodPeaks
    readonly open: PeriodPeaks
  }
  /** The latest audit entries; null when the viewer may not read the audit. */
  readonly recentAudit: AuditEntry[] | null
  /** The latest Catalog Import Run (null before any); the whole field is null for a moderator. */
  readonly catalogImport: { readonly lastRun: CatalogImportRun | null } | null
}

export interface IGetAdminOverviewUseCase {
  execute(input: GetAdminOverviewInput): Promise<GetAdminOverviewOutput>
}

/**
 * The Overview: the live numbers, the period totals of completed Squads and sign-ups beside those of
 * the previous period (sums of the same series the chart draws, so they always agree), the peak online
 * and peak Open Squads of both periods and, for an admin or the owner, the latest audit entries and
 * the last Catalog Import Run.
 */
export class GetAdminOverviewUseCase implements IGetAdminOverviewUseCase {
  constructor(
    private readonly statsRepository: IAdminStatsRepository,
    private readonly auditEntryRepository: IAuditEntryRepository,
    private readonly catalogImportRunRepository: ICatalogImportRunRepository,
    private readonly activity: IGetAdminActivityUseCase,
    private readonly onlinePresence: OnlinePresence,
    private readonly clock: Clock
  ) {}

  async execute(input: GetAdminOverviewInput): Promise<GetAdminOverviewOutput> {
    const { period } = input
    const fullAdmin = hasFullAdminAccess(input.viewerRole)
    // One read: the live count and the four series must agree on what today is.
    const now = this.clock.now()
    const [
      totalUsers,
      openSquads,
      completedSquads,
      completed,
      signups,
      online,
      open,
      recentAudit,
      lastRun,
    ] = await Promise.all([
      this.statsRepository.countUsers(),
      this.statsRepository.countOpenSquads(now),
      this.statsRepository.countCompletedSquads(),
      this.activity.execute({ metric: 'completed', period, now }),
      this.activity.execute({ metric: 'signups', period, now }),
      this.activity.execute({ metric: 'online', period, now }),
      this.activity.execute({ metric: 'open', period, now }),
      fullAdmin
        ? this.auditEntryRepository.list(0, OVERVIEW_AUDIT_LIMIT).then((page) => page.entries)
        : Promise.resolve(null),
      fullAdmin ? this.catalogImportRunRepository.findLatest() : Promise.resolve(null),
    ])

    return {
      period,
      live: {
        onlineUsers: this.onlinePresence.countOnlineUsers(),
        totalUsers,
        openSquads,
        completedSquads,
      },
      metrics: {
        completed: totalPeriods(completed.rows),
        signups: totalPeriods(signups.rows),
        online: peakPeriods(online.rows),
        open: peakPeriods(open.rows),
      },
      recentAudit,
      catalogImport: fullAdmin ? { lastRun } : null,
    }
  }
}
