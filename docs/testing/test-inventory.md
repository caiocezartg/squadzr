# Test inventory

Canonical runner for every workspace: **Vitest**. `bun test` is no longer a test entry point; Bun
remains the package manager and the server runtime.

## Commands

| Purpose | Command |
| --- | --- |
| Full suite (single root entry) | `bun run test` (delegates to `turbo test`) |
| Direct root composition | `bunx vitest run` (composes `vitest.workspace.ts`) |
| Root watch composition | `bun run test:watch` (same composition, watch mode) |
| Focused workspace run | `bunx turbo test --filter=<workspace>` |
| Direct workspace run | `bun run test` inside the workspace directory |

`vitest.workspace.ts` composes the four projects by pointing at each workspace directory, whose own
`vitest.config.ts` stays the single source of truth (see
https://v2.vitest.dev/guide/workspace). Focused and direct runs execute the exact same script
Turbo executes for the root command, so the root suite and the focused suites always share one
inventory (see the equivalence proof below).

## Projects

| Workspace | Vitest project | Environment | Include pattern | Suites | Tests |
| --- | --- | --- | --- | --- | --- |
| `server` | `server:unit` | `node` | `src/**/*.spec.ts` | 10 | 39 |
| `client` | `client:unit` | `jsdom` | `src/**/*.spec.{ts,tsx}` | 1 | 3 |
| `@squadzr/schemas` | `schemas:unit` | `node` | `src/**/*.spec.ts` | 1 | 6 |
| `@squadzr/types` | `types:unit` | `node` | `src/**/*.spec.ts` | 1 | 2 |
| `@squadzr/typescript-config` | — | — | — | — | — |

`@squadzr/typescript-config` ships only shared TypeScript configuration files, so no test project is
expected there. Every other workspace must keep at least one test file: the configs deliberately do
not use `--passWithNoTests`, so a workspace whose include pattern stops matching fails its own
script with exit code 1 (`No test files found`), which in turn fails `bun run test` (Turbo). A
Vitest 2.1 nuance verified on 2026-09-25: the direct root composition (`bunx vitest run`) silently
skips a project whose include matches no files and exits 0, so the no-masking gate is the
per-workspace script executed by Turbo, not the root composition. Delete a suite only together
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

When the first integration project lands, it must be composed in the root `vitest.workspace.ts`
as an additional entry that loads its own project config (Vitest 2.1 composes multiple projects
through the workspace file, per https://v2.vitest.dev/guide/workspace), carry an explicit
`*:integration` name with its own `include` pattern, and be recorded in this table.

## Known limitations

- The direct root composition (`bunx vitest run`) silently skips a project whose include matches
  no files and exits 0 (Vitest 2.1 behavior, verified empirically on 2026-09-25). The enforced
  no-masking gate is therefore the per-workspace script run by `bun run test` (Turbo), which
  fails with exit code 1 when a workspace's expected suite is missing.
- `@squadzr/typescript-config` has no `test` script, so Turbo skips it when running `turbo test`;
  the no-masking guarantee lives in the Vitest configs (no `--passWithNoTests`) and in the root
  composition listing exactly the four expected projects.
- The `schemas:unit` suite characterizes the legacy room `status` contract (`roomStatusSchema`),
  which is still the live runtime contract today. CCC-35 removes that contract and must update
  the test together with the schema.
- The former root `test:coverage` script (`vitest run --coverage`) never worked on the base
  commit: no coverage provider (`@vitest/coverage-v8`) is installed, so the run failed before
  collecting tests. The script was removed instead of being restored with a new dependency;
  introducing coverage tooling is a deliberate follow-up decision, not an accidental default.

## Equivalence proof (CCC-28)

Recorded on 2026-09-25 (review round), Bun 1.3.8, Vitest 2.1.9, Windows:

| Command | Test files | Tests |
| --- | --- | --- |
| `bun run test` (root, all projects) | 13 | 50 |
| `bunx vitest run` (direct root composition) | 13 | 50 |
| `bunx turbo test --filter=server` | 10 | 39 |
| `bunx turbo test --filter=client` | 1 | 3 |
| `bunx turbo test --filter=@squadzr/schemas` | 1 | 6 |
| `bunx turbo test --filter=@squadzr/types` | 1 | 2 |

The direct root composition matches the Turbo run, the focused runs match the per-workspace
numbers of the root run, and the server suite preserves the historical baseline of 39 tests /
10 suites with unchanged test names. Per-suite server counts: create-room 8, join-room 9,
leave-room 4, delete-expired-rooms 4, get-available-rooms 3, get-my-rooms 2, get-room-by-code 2,
create-user 2, get-user 2, update-user 3.

To re-verify after changes: run `bun run test`, `bunx vitest run`, and each
`bunx turbo test --filter=<workspace>` above, then compare the `Test Files` / `Tests` summaries.
`bun run test:watch` runs the same composition in watch mode; in non-interactive terminals
(piped output) it executes the suite once, which is how the script is verified. Server project
membership is visible in verbose output: `bun run test --reporter=verbose` inside `server` tags
every line with `|server:unit|`.
