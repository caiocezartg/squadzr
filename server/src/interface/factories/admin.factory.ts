import type { Database } from '@infrastructure/database/drizzle'
import type { Clock } from '@domain/services/clock.interface'
import { DrizzleAuditEntryRepository } from '@infrastructure/repositories/drizzle-audit-entry.repository'
import { DrizzleUserRepository } from '@infrastructure/repositories/drizzle-user.repository'
import { GrantAdminUseCase } from '@application/use-cases/admin/grant-admin.use-case'
import { ListAuditEntriesUseCase } from '@application/use-cases/admin/list-audit-entries.use-case'
import { AdminAuditController } from '@interface/controllers/admin-audit.controller'

export function createAdminAuditController(db: Database): AdminAuditController {
  const listAuditEntriesUseCase = new ListAuditEntriesUseCase(new DrizzleAuditEntryRepository(db))

  return new AdminAuditController({ listAuditEntriesUseCase })
}

/** The use case behind the `admin:grant` script, on the caller's own database connection. */
export function createGrantAdminUseCase(db: Database, clock: Clock): GrantAdminUseCase {
  return new GrantAdminUseCase(new DrizzleUserRepository(db), clock)
}
