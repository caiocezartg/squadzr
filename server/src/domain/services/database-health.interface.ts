/**
 * Database reachability as the readiness probe checks it. Resolves when the
 * database answers a trivial query, and rejects when it does not.
 */
export interface IDatabaseHealth {
  ping(): Promise<void>
}
