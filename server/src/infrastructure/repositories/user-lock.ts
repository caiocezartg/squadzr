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
 * and Membership rows. No transaction waits for an existing room while holding
 * the user lock, so concurrent joins by one user into different rooms and
 * concurrent creations by one host cannot form a lock cycle.
 */
export async function lockUserRow(tx: DatabaseTransaction, userId: string): Promise<void> {
  await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for('update')
}
