export const ROOM = {
  CODE_LENGTH: 6,
  CREATE_LIMIT: 3,
  JOIN_LIMIT: 5,
  DEFAULT_MAX_PLAYERS: 5,
  CLEANUP_INTERVAL_MS: 60_000,
  NOTIFICATION_LIMIT: 20,
  /** An Open Room expires 24h after its last durable Membership change. */
  OPEN_ROOM_TTL_MS: 24 * 60 * 60_000,
  /** A Ready Room stays accessible to its members for 60min after `readyAt`. */
  READY_ROOM_RETENTION_MS: 60 * 60_000,
} as const
