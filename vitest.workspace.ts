import { defineWorkspace } from 'vitest/config'

// Root composition of every Vitest project (https://v2.vitest.dev/guide/workspace).
// Each entry points at a workspace directory whose own vitest.config.ts stays the
// single source of truth, so a direct root run (`bunx vitest run`), the root watch
// script (`bun run test:watch`), and the focused workspace commands all execute
// the same inventory recorded in docs/testing/test-inventory.md.
export default defineWorkspace(['client', 'server', 'packages/schemas', 'packages/types'])
