import { eq } from 'drizzle-orm'
import type { Database } from '@infrastructure/database/drizzle'
import { user } from '@infrastructure/database/schema/auth'

/** Transaction handle of `Database`, for helpers that must share its connection. */
export type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0]

/**
 * Serializes the per-user room limits on the transaction connection.
 *
 * The global lock order is: the room of the join, then the user of the join, then (only
 * when that join makes its Squad Ready) the other Open Squads that hold a Membership of
 * its members, in ascending `id`, then the users who might inherit a Squad that lost its
 * host, in ascending `id`. `create` has no existing room row to lock: it takes its user
 * row first and only inserts brand-new room and Membership rows, so it never waits for
 * an existing room while holding the user lock. Two Squads that become Ready at once with
 * a member in common (or one of them and a plain join) can still wait for each other; the
 * join runs again when PostgreSQL aborts it for the deadlock. NO KEY UPDATE serializes
 * these counts without conflicting with KEY SHARE from user foreign keys: crossed final
 * joins can insert notifications for each other's hosts without a lock cycle.
 */
export async function lockUserRow(tx: DatabaseTransaction, userId: string): Promise<void> {
  await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for('no key update')
}
