export abstract class AppError extends Error {
  abstract readonly statusCode: number
  abstract readonly code: string
  /** Set by errors that know when the caller may try again; the HTTP layer turns it into a body field and a header. */
  readonly retryAfterMs?: number

  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
    }
  }
}
