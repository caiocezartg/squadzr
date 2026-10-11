import type { Database } from '@infrastructure/database/drizzle'
import { DrizzleDatabaseHealth } from '@infrastructure/services/drizzle-database-health'
import { CheckReadinessUseCase } from '@application/use-cases/health/check-readiness.use-case'
import { HealthController } from '@interface/controllers/health.controller'

export function createHealthController(db: Database): HealthController {
  const databaseHealth = new DrizzleDatabaseHealth(db)
  const checkReadinessUseCase = new CheckReadinessUseCase(databaseHealth)

  return new HealthController({ checkReadinessUseCase })
}
