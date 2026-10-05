/**
 * Command-only public entry point of the catalog capability. Capabilities that
 * change the catalog after a Membership change (room creation, room joining
 * and the live lobby) import `useCatalogCommands` from here instead of the
 * barrel: the barrel also exports `CatalogPage`, which composes those
 * capabilities, so importing it would create a cycle. Query keys and cache
 * mutations stay internal.
 */
export { useCatalogCommands, type CatalogCommands } from './use-catalog-commands'
