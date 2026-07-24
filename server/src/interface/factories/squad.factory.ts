import type { Database } from '@infrastructure/database/drizzle'
import { DrizzleSquadLifecycle } from '@infrastructure/squad-lifecycle/drizzle-squad-lifecycle'
import { SquadController } from '@interface/controllers/squad.controller'

export function createSquadController(db: Database): SquadController {
  return new SquadController(new DrizzleSquadLifecycle(db))
}
