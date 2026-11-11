export const ROOM = {
  CODE_LENGTH: 6,
  /** Open Squads a person may host at once, also when a Host Transfer would make them host. */
  CREATE_LIMIT: 1,
  /** Memberships in valid Open Squads a person may hold at once, the one they host included. */
  JOIN_LIMIT: 3,
  CLEANUP_INTERVAL_MS: 60_000,
  NOTIFICATION_LIMIT: 20,
  /** An Open Room expires 24h after its last durable Membership change. */
  OPEN_ROOM_TTL_MS: 24 * 60 * 60_000,
  /** A Ready Room stays accessible to its members for 60min after `readyAt`. */
  READY_ROOM_RETENTION_MS: 60 * 60_000,
} as const

export const ADMIN = {
  /** The calendar the panel's days and periods follow: every per-day series buckets in this zone. */
  TIME_ZONE: 'America/Sao_Paulo',
  /** How often the sampler records an Activity Sample. */
  ACTIVITY_SAMPLE_INTERVAL_MS: 5 * 60_000,
} as const

export const GAME_CATALOG_IMPORT = {
  /** Candidates must reach this share of today's Listed Games, or the run stops. */
  MINIMUM_RETAINED_FRACTION: 0.5,
  /** Absolute candidate floor of every run, including the first one. */
  MINIMUM_CANDIDATES: 10,
} as const

export const CATALOG_IMPORT_RUN = {
  /** A running import proves it is alive this often. */
  HEARTBEAT_INTERVAL_MS: 30_000,
  /** A `running` run silent for longer than this was abandoned (a crash or a deploy). */
  STALE_HEARTBEAT_MS: 2 * 60_000,
  /** A `requested` run nobody claimed within this long was abandoned. */
  STALE_REQUESTED_MS: 10 * 60_000,
  /** The API's executor looks for a queued run this often besides being woken by a request. */
  EXECUTOR_POLL_INTERVAL_MS: 15_000,
  /** On shutdown the executor waits this long for the run in flight before letting go of it. */
  EXECUTOR_SHUTDOWN_GRACE_MS: 10_000,
  /** The longest error message a run keeps. */
  ERROR_MESSAGE_MAX_LENGTH: 2000,
} as const
