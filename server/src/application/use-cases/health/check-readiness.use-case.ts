import type { IDatabaseHealth } from '@domain/services/database-health.interface'

export interface CheckReadinessOutput {
  /** False when the database did not answer, so the service cannot serve requests. */
  readonly ready: boolean
}

export interface ICheckReadinessUseCase {
  execute(): Promise<CheckReadinessOutput>
}

export class CheckReadinessUseCase implements ICheckReadinessUseCase {
  constructor(private readonly databaseHealth: IDatabaseHealth) {}

  async execute(): Promise<CheckReadinessOutput> {
    try {
      await this.databaseHealth.ping()
      return { ready: true }
    } catch {
      return { ready: false }
    }
  }
}
