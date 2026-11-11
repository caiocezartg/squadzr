import type { Clock } from '@domain/services/clock.interface'
import { OwnerAlreadyExistsError, UserNotFoundError } from '@application/errors'
import type { GrantableRole } from '@application/use-cases/admin/grant-admin.use-case'
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
  /** `admin` unless the operator asks for the owner. */
  readonly role?: GrantableRole
  readonly clock?: Clock
  readonly logger?: GrantAdminLogger
}

const consoleLogger: GrantAdminLogger = {
  info: (message) => console.log(message),
  error: (message) => console.error(message),
}

function grantFailureMessage(error: unknown, options: GrantAdminEntryOptions): string {
  if (error instanceof UserNotFoundError) {
    return `No user has the id or Discord id "${options.identifier}"; nothing was written.`
  }
  if (error instanceof OwnerAlreadyExistsError) {
    return `${error.message}; there is at most one owner, nothing was written.`
  }
  const detail = error instanceof Error ? error.message : String(error)
  return `Granting the ${options.role ?? 'admin'} role failed: ${detail}`
}

/**
 * Process entry of `admin:grant`: opens its own pool, makes one person an admin (or the owner) and
 * always closes the pool. Returns the process exit code: 0 when the person now holds the role (also
 * when they already did), 1 for an unknown id, a second owner or a failure. It writes nothing for an
 * unknown id or a second owner and never demotes.
 */
export async function runGrantAdmin(options: GrantAdminEntryOptions): Promise<number> {
  const logger = options.logger ?? consoleLogger
  const { db, close } = createDatabase(options.databaseUrl)
  let exitCode = 0

  try {
    const useCase = createGrantAdminUseCase(db, options.clock ?? new SystemClock())
    const { user, role, granted } = await useCase.execute({
      identifier: options.identifier,
      role: options.role,
    })

    logger.info(
      granted
        ? `Granted the ${role} role to ${user.name} (${user.id}).`
        : `${user.name} (${user.id}) already holds the ${user.role} role; nothing changed.`
    )
  } catch (error) {
    exitCode = 1
    logger.error(grantFailureMessage(error, options))
  }

  try {
    await close()
  } catch (error) {
    exitCode = 1
    logger.error(`Closing the database connection failed: ${String(error)}`)
  }

  return exitCode
}
