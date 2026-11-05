import type { Clock } from '@domain/services/clock.interface'
import { UserNotFoundError } from '@application/errors'
import { createDatabase } from '@infrastructure/database/drizzle'
import { SystemClock } from '@infrastructure/services/system-clock'
import { createGrantAdminUseCase } from '@interface/factories/admin.factory'

/** Where the script reports; tests inject a fake to read the messages. */
export interface GrantAdminLogger {
  info(message: string): void
  error(message: string): void
}

export interface GrantAdminEntryOptions {
  readonly databaseUrl: string
  /** A user id, or else a Discord account id. */
  readonly identifier: string
  readonly clock?: Clock
  readonly logger?: GrantAdminLogger
}

const consoleLogger: GrantAdminLogger = {
  info: (message) => console.log(message),
  error: (message) => console.error(message),
}

/**
 * Process entry of `admin:grant`: opens its own pool, makes one person an admin and always closes the
 * pool. Returns the process exit code: 0 when the person is now an admin (also when they already were),
 * 1 for an unknown id or a failure. It writes nothing for an unknown id and never demotes.
 */
export async function runGrantAdmin(options: GrantAdminEntryOptions): Promise<number> {
  const logger = options.logger ?? consoleLogger
  const { db, close } = createDatabase(options.databaseUrl)
  let exitCode = 0

  try {
    const useCase = createGrantAdminUseCase(db, options.clock ?? new SystemClock())
    const { user, granted } = await useCase.execute({ identifier: options.identifier })

    logger.info(
      granted
        ? `Granted the admin role to ${user.name} (${user.id}).`
        : `${user.name} (${user.id}) is already an admin; nothing changed.`
    )
  } catch (error) {
    exitCode = 1
    logger.error(
      error instanceof UserNotFoundError
        ? `No user has the id or Discord id "${options.identifier}"; nothing was written.`
        : `Granting the admin role failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  try {
    await close()
  } catch (error) {
    exitCode = 1
    logger.error(`Closing the database connection failed: ${String(error)}`)
  }

  return exitCode
}
