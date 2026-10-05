/**
 * Public interface of the catalog capability. The route renders `CatalogPage`;
 * capabilities the page composes import `useCatalogCommands` from the
 * `./commands` entry point after Membership changes, so they never pull the
 * page back through this barrel. Query keys, realtime event names, URL
 * filters, pagination and cache mutations stay internal.
 */
export { CatalogPage } from './catalog-page'
export { useCatalogCommands, type CatalogCommands } from './use-catalog-commands'
