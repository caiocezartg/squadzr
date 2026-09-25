# Test inventory

Canonical runner for every workspace: **Vitest**. `bun test` is no longer a test entry point; Bun
remains the package manager and the server runtime.

## Commands

| Purpose | Command |
| --- | --- |
| Full suite (single root entry) | `bun run test` (delegates to `turbo test`) |
| Focused workspace run | `bunx turbo test --filter=<workspace>` |
| Direct workspace run | `bun run test` inside the workspace directory |

Focused and direct runs execute the exact same script Turbo executes for the root command, so the
root suite and the focused suites always share one inventory (see the equivalence proof below).

## Projects

| Workspace | Vitest project | Environment | Include pattern | Suites | Tests |
| --- | --- | --- | --- | --- | --- |
| `server` | `server:unit` | `node` | `src/**/*.spec.ts` | 10 | 39 |
| `client` | `client:unit` | `jsdom` | `src/**/*.spec.{ts,tsx}` | 1 | 3 |
| `@squadzr/schemas` | `schemas:unit` | `node` | `src/**/*.spec.ts` | 1 | 6 |
| `@squadzr/types` | `types:unit` | `node` | `src/**/*.spec.ts` | 1 | 1 |
| `@squadzr/typescript-config` | — | — | — | — | — |

`@squadzr/typescript-config` ships only shared TypeScript configuration files, so no test project is
expected there. Every other workspace must keep at least one test file: the configs deliberately do
not use `--passWithNoTests`, so a workspace whose expected suite disappears (or whose include
pattern stops matching) fails the run instead of silently passing. Delete a suite only together
with its project entry.

## Unit and integration projects

Project names carry the suite kind after the `:` separator. Today every project is a unit project
(`*:unit`) running against mock/in-memory dependencies:

- `server:unit` — 39 historical use-case tests across 10 specs (also the historical baseline
  recorded for this monorepo, retained under Vitest with identical assertions and test names).
- `client:unit` — runs in jsdom; the environment is proven by an assertion on `document`, which
  fails under a Node environment.
- `schemas:unit` — runtime contract tests for the shared Zod schemas.
- `types:unit` — loads every static contract entry point in Node (the package intentionally has no
  runtime exports).

Integration projects are explicitly reserved for later issues and will follow the same naming
convention:

- `server:integration` (planned in CCC-29/CCC-31) — Fastify injection and PostgreSQL 16 suites
  under `server/tests/integration/**`.
- Client and realtime flows stay in jsdom projects under the planned capability work
  (CCC-32/CCC-33).

When the first integration project lands, it must be declared in the owning workspace's
`vitest.config.ts` with its own `include` pattern and `*:integration` name, and recorded in this
table.

## Equivalence proof (CCC-28)

Recorded on 2026-09-24, Bun 1.3.8, Vitest 2.1.9, Windows:

| Command | Test files | Tests |
| --- | --- | --- |
| `bun run test` (root, all projects) | 13 | 49 |
| `bunx turbo test --filter=server` | 10 | 39 |
| `bunx turbo test --filter=client` | 1 | 3 |
| `bunx turbo test --filter=@squadzr/schemas` | 1 | 6 |
| `bunx turbo test --filter=@squadzr/types` | 1 | 1 |

The focused runs match the per-workspace numbers of the root run, and the server suite preserves
the historical baseline of 39 tests / 10 suites with unchanged test names. Per-suite server counts:
create-room 8, join-room 9, leave-room 4, delete-expired-rooms 4, get-available-rooms 3,
get-my-rooms 2, get-room-by-code 2, create-user 2, get-user 2, update-user 3.

To re-verify after changes: run `bun run test`, then each `bunx turbo test --filter=<workspace>`
above, and compare the `Test Files` / `Tests` summaries. Server project membership is visible in
verbose output: `bun run test --reporter=verbose` inside `server` tags every line with
`|server:unit|`.
