import type { Database } from '@infrastructure/database/drizzle'
import type { Clock } from '@domain/services/clock.interface'
import type { OnlinePresence } from '@domain/services/online-presence.interface'
import { DrizzleAdminUserRepository } from '@infrastructure/repositories/drizzle-admin-user.repository'
import { DrizzleSquadRecordRepository } from '@infrastructure/repositories/drizzle-squad-record.repository'
import { ChangeUserRoleUseCase } from '@application/use-cases/admin/change-user-role.use-case'
import { GetAdminUserUseCase } from '@application/use-cases/admin/get-admin-user.use-case'
import { ListAdminUsersUseCase } from '@application/use-cases/admin/list-admin-users.use-case'
import { AdminUsersController } from '@interface/controllers/admin-users.controller'

export function createAdminUsersController(
  db: Database,
  clock: Clock,
  onlinePresence: OnlinePresence
): AdminUsersController {
  const adminUserRepository = new DrizzleAdminUserRepository(db)

  return new AdminUsersController({
    listAdminUsersUseCase: new ListAdminUsersUseCase(adminUserRepository, clock),
    getAdminUserUseCase: new GetAdminUserUseCase(
      adminUserRepository,
      new DrizzleSquadRecordRepository(db),
      onlinePresence,
      clock
    ),
    changeUserRoleUseCase: new ChangeUserRoleUseCase(adminUserRepository, clock),
  })
}
