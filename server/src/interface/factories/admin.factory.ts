import type { Database } from '@infrastructure/database/drizzle'
import type { Clock } from '@domain/services/clock.interface'
import type { IRoomBroadcaster } from '@domain/services/room-broadcaster.interface'
import { DrizzleAdminSquadRepository } from '@infrastructure/repositories/drizzle-admin-squad.repository'
import { DrizzleAuditEntryRepository } from '@infrastructure/repositories/drizzle-audit-entry.repository'
import { DrizzleUserRepository } from '@infrastructure/repositories/drizzle-user.repository'
import { CloseSquadUseCase } from '@application/use-cases/admin/close-squad.use-case'
import { GetAdminSquadUseCase } from '@application/use-cases/admin/get-admin-squad.use-case'
import { GrantAdminUseCase } from '@application/use-cases/admin/grant-admin.use-case'
import { ListAdminSquadsUseCase } from '@application/use-cases/admin/list-admin-squads.use-case'
import { ListAuditEntriesUseCase } from '@application/use-cases/admin/list-audit-entries.use-case'
import { AdminAuditController } from '@interface/controllers/admin-audit.controller'
import { AdminSquadsController } from '@interface/controllers/admin-squads.controller'

export function createAdminAuditController(db: Database): AdminAuditController {
  const listAuditEntriesUseCase = new ListAuditEntriesUseCase(new DrizzleAuditEntryRepository(db))

  return new AdminAuditController({ listAuditEntriesUseCase })
}

/** The use case behind the `admin:grant` script, on the caller's own database connection. */
export function createGrantAdminUseCase(db: Database, clock: Clock): GrantAdminUseCase {
  return new GrantAdminUseCase(new DrizzleUserRepository(db), clock)
}

export function createAdminSquadsController(
  db: Database,
  broadcaster: IRoomBroadcaster,
  clock: Clock
): AdminSquadsController {
  const adminSquadRepository = new DrizzleAdminSquadRepository(db, clock)

  return new AdminSquadsController({
    listAdminSquadsUseCase: new ListAdminSquadsUseCase(adminSquadRepository),
    getAdminSquadUseCase: new GetAdminSquadUseCase(adminSquadRepository),
    closeSquadUseCase: new CloseSquadUseCase(adminSquadRepository),
    broadcaster,
  })
}
