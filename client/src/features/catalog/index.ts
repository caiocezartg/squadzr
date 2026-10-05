/**
 * Public interface of the catalog capability. The route renders `CatalogPage`
 * and the live lobby uses `useCatalogCommands` after Membership changes.
 * Query keys, realtime event names, URL filters, pagination and cache
 * mutations stay internal.
 */
export { CatalogPage } from './catalog-page'
export { useCatalogCommands, type CatalogCommands } from './use-catalog-commands'
