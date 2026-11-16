import { AppError } from './base.error'

/** Discord could not be asked about an invite (rate limiting, slow or down), so no Squad can be created now. */
export class DiscordUnavailableError extends AppError {
  readonly statusCode = 503
  readonly code = 'DISCORD_UNAVAILABLE'

  /** `retryAfterMs` is how long Discord asked to wait, when it said so. */
  constructor(readonly retryAfterMs?: number) {
    super('Discord could not be reached to check the invite, try again in a few seconds')
  }
}
