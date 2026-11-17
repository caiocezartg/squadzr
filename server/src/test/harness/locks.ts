import type pg from 'pg'

/** Every concurrent operation of a lock test must finish within this deadline. */
export const COMPLETION_LIMIT_MS = 5_000

export async function withinDeadline<T>(work: Promise<T>, description: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${description} did not finish within ${COMPLETION_LIMIT_MS}ms`)),
          COMPLETION_LIMIT_MS
        )
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Waits until `expected` sessions of this test database are parked on a row lock
 * (`FOR UPDATE`). PostgreSQL caches activity snapshots until the control transaction
 * ends, so the snapshot is cleared on every poll. A send that takes no lock never
 * parks, so a missing lock fails here instead of passing by luck.
 */
export async function waitForLockedSessions(control: pg.Client, expected: number): Promise<void> {
  const deadline = performance.now() + COMPLETION_LIMIT_MS
  while (performance.now() < deadline) {
    await control.query('SELECT pg_stat_clear_snapshot()')
    const { rows } = await control.query<{ waiting: number }>(`
      SELECT count(*)::int AS waiting FROM pg_stat_activity
      WHERE datname = current_database()
        AND wait_event_type = 'Lock'
        AND (query LIKE '%for update' OR query LIKE '%for no key update')
    `)
    if ((rows[0]?.waiting ?? 0) >= expected) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Not all ${expected} sessions reached the lock barrier`)
}
