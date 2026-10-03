import { eq } from 'drizzle-orm'
import type { Database } from '@infrastructure/database/drizzle'
import { user } from '@infrastructure/database/schema/auth'

/** Transaction handle of `Database`, for helpers that must share its connection. */
export type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0]

/**
 * Serializes the per-user room limits on the transaction connection.
 *
 * The global lock order is: existing room rows first, then the user row.
 * `joinOpenRoom` locks the room and then the user; `create` has no existing
 * room row to lock, takes the user row first and only inserts brand-new room
 * and Membership rows. Neither limit transaction waits for an existing room
 * while holding the user lock. NO KEY UPDATE serializes these counts without
 * conflicting with KEY SHARE from user foreign keys: crossed final joins
 * can insert notifications for each other's hosts without a lock cycle.
 */
export async function lockUserRow(tx: DatabaseTransaction, userId: string): Promise<void> {
  await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for('no key update')
}
