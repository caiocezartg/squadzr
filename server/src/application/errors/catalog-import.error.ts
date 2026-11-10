import { AppError } from './base.error'

/** The API has no IGDB credentials, so it cannot run an import (the cron still can). */
export class CatalogImportUnavailableError extends AppError {
  readonly statusCode = 503
  readonly code = 'CATALOG_IMPORT_UNAVAILABLE'

  constructor() {
    super('The Catalog Import is not configured on this server')
  }
}

/** A manual run was already requested in the last 24 hours, whatever became of it. */
export class CatalogImportManualLimitError extends AppError {
  readonly statusCode = 422
  readonly code = 'CATALOG_IMPORT_MANUAL_LIMIT'

  constructor(readonly availableAt: Date) {
    super(`A manual Catalog Import can be requested again at ${availableAt.toISOString()}`)
  }
}

/** Another Catalog Import Run is requested or running: there is one slot. */
export class CatalogImportRunningError extends AppError {
  readonly statusCode = 422
  readonly code = 'CATALOG_IMPORT_RUNNING'

  constructor() {
    super('A Catalog Import is already requested or running')
  }
}
