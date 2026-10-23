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

`vitest.workspace.ts` composes the three projects by pointing at each workspace directory, whose own
`vitest.config.ts` stays the single source of truth (see
https://v2.vitest.dev/guide/workspace). Focused and direct runs execute the exact same script
Turbo executes for the root command, so the root suite and the focused suites always share one
inventory (see the equivalence proof below).

## Projects

| Workspace | Vitest project | Environment | Include pattern | Suites | Tests |
| --- | --- | --- | --- | --- | --- |
| `server` | `server:unit` | `node` | `src/**/*.spec.ts` | 26 | 122 |
| `server` | `server:integration` | `node` | `tests/integration/**/*.test.ts` | 25 | 233 |
| `client` | `client:unit` | `jsdom` | `src/**/*.spec.{ts,tsx}`, `scripts/**/*.spec.mjs` | 58 | 467 |
| `@squadzr/schemas` | `schemas:unit` | `node` | `src/**/*.spec.ts` | 4 | 78 |
| `@squadzr/typescript-config` | — | — | — | — | — |

Suites are test files. The counts above are the current inventory, recounted on 2026-10-23 for
CCC-95. The previous recount (2026-10-22, CCC-88) added `tests/integration/catalog-migration.test.ts`
and recorded `server:integration` at 25 files / 231 tests. The CCC-70 recount itself added
`src/env.spec.ts`, `src/lib/router-history.spec.ts` and `scripts/bundle-report.spec.mjs` to
`client:unit`, corrected the server and client unit rows that had drifted since the 2026-10-09
recount, and corrected the `server:integration` row, which had drifted since CCC-59. The CCC-28
numbers are kept as a historical record in the equivalence proof below.

CCC-95 adds tests to each suite it touches: the legacy notification payload contract case and the
game-cover payload case in `schemas:unit` (+2), the builder cover/omission cases and the join
use-case cover flow in `server:unit` (+3), the covered and uncovered menu renderings in `client:unit`
(+2), and the cover over HTTP and the realtime channel in `server:integration` (+2).

`@squadzr/typescript-config` ships only shared TypeScript configuration files, so no test project is
expected there. Every other workspace must keep at least one test file: the configs deliberately do
not use `--passWithNoTests`, so a workspace whose include pattern stops matching fails its own
script with exit code 1 (`No test files found`), which in turn fails `bun run test` (Turbo). A
Vitest 2.1 nuance verified on 2026-09-25: the direct root composition (`bunx vitest run`) silently
skips a project whose include matches no files and exits 0, so the no-masking gate is the
per-workspace script executed by Turbo, not the root composition. Delete a suite only together
with its project entry.

## Unit and integration projects

Project names carry the suite kind after the `:` separator. Unit projects (`*:unit`) run against
mock/in-memory dependencies:

- `server:unit` — 97 tests across 22 spec files as of 2026-10-08. CCC-58 removed the
  `create-user` (2 tests) and `update-user` (3 tests) specs together with their use cases. The
  CCC-28 baseline of 39 tests across 10 specs is historical; see the equivalence proof below.
- `client:unit` — runs in jsdom; the environment is proven by an assertion on `document`, which
  fails under a Node environment. `scripts/bundle-report.spec.mjs` checks the bundle report of the
  Next build (`client/scripts/bundle-report.mjs`) against a fixture of manifests; it stays in this
  project because the shared setup file needs jsdom globals.
- `schemas:unit` — runtime contract tests for the shared Zod schemas.

Integration projects follow the same naming convention:

- `server:integration` (CCC-29) — Fastify injection and PostgreSQL 16 suites under
  `server/tests/integration/**`, configured by `server/vitest.integration.config.ts`. Run it with
  `bun run test:integration` inside `server/` after starting the disposable database with
  `docker compose -f docker-compose.test.yml up -d --wait` (PostgreSQL 16 on port 5433, tmpfs
  storage). `TEST_DATABASE_URL` overrides the admin connection
  (default `postgresql://postgres:postgres@localhost:5433/postgres`). Migration suites
  (`room-lifecycle-migration`, `catalog-migration`) replay the checked-in SQL files against a
  throwaway database and pin the migration they exercise by tag, so later migrations cannot
  silently change what they prove. `catalog-migration` (CCC-88) seeds a legacy game and a Squad
  that references it, then asserts the catalog migration delists the game, keeps the Squad and
  applies the defaults.
- Client and realtime flows stay in jsdom projects under the planned capability work
  (CCC-32/CCC-33).

Realtime characterization (CCC-33) spans both sides of the `/ws` protocol:

- `server:integration` — `tests/integration/realtime-{connections,payloads,disconnects}.test.ts`
  open in-memory sockets through `app.injectWS` (no ports, no network) with the helpers in
  `server/src/test/harness/realtime.ts`: `connect()` (guest or Better Auth session cookie),
  `drain()` (ping/pong barrier for synchronous handlers; DB-backed handlers such as `join_room`
  are awaited message by message), and `subscriptionState()` (read-only probe of catalog/room
  subscriptions). The harness destroys the in-memory stream once both directions end, as a TCP
  socket would; otherwise `ws` keeps the server socket CLOSING for its 30 s fallback timer.
- `client:unit` — `src/lib/ws-client.spec.ts` (reconnect backoff with fake timers) and
  `src/test/realtime-reconnect.spec.tsx` (catalog/lobby resubscription and cleanup on the real
  pages). `MockWebSocket.close(code)` accepts a close code (default 1000).
- Assertions tagged `REPLACED BY CCC-37` (server) or `REPLACED BY CCC-38` (client) record the
  current Membership/Presence conflation, payload limits and error codes as behavior to replace,
  not preserve.

How the server harness works (`server/src/test/harness/`):

- `global-setup.ts` asserts the server is PostgreSQL 16, creates one template database per run,
  applies every Drizzle migration from `server/drizzle/` to it, and drops the template plus any
  leftover per-test database when the run ends.
- `buildTestServer()` clones the template into a fresh database for the calling test, then builds
  a ready, non-listening app through `buildApp({ env, logger: false })`. Its `close()` shuts the
  app down (Fastify, WebSocket clients, the room-cleanup interval, the pool) and drops the
  database, so every test starts from the same migrated, empty state and instances never share
  data, even across parallel workers.

`server:integration` is deliberately not part of `bun run test` (Turbo) nor of the root
`vitest.workspace.ts` composition: it needs an external PostgreSQL 16 server, and the unit gate
must keep running without Docker. CI runs it as the separate `integration-tests` required check
against a PostgreSQL 16 service (see [`docs/ci/quality-gates.md`](../ci/quality-gates.md)).

## Known limitations

- The direct root composition (`bunx vitest run`) silently skips a project whose include matches
  no files and exits 0 (Vitest 2.1 behavior, verified empirically on 2026-09-25). The enforced
  no-masking gate is therefore the per-workspace script run by `bun run test` (Turbo), which
  fails with exit code 1 when a workspace's expected suite is missing.
- `@squadzr/typescript-config` has no `test` script, so Turbo skips it when running `turbo test`;
  the no-masking guarantee lives in the Vitest configs (no `--passWithNoTests`) and in the root
  composition listing exactly the three expected projects.
- The `schemas:unit` suite used to characterize the legacy room `status` contract
  (`roomStatusSchema`). CCC-35 removed that contract from `@squadzr/schemas`, so the suite now
  covers the remaining runtime contracts (create-room input, notification payload, and the room,
  game, and user transport shapes) instead.
- The former root `test:coverage` script (`vitest run --coverage`) never worked on the base
  commit: no coverage provider (`@vitest/coverage-v8`) is installed, so the run failed before
  collecting tests. The script was removed instead of being restored with a new dependency;
  introducing coverage tooling is a deliberate follow-up decision, not an accidental default.

## Equivalence proof (CCC-28, CCC-58, CCC-59)

### Current counts (recounted 2026-10-15, CCC-70)

| Command | Test files | Tests |
| --- | --- | --- |
| `bun run test` (root, all projects; sum of the three unit projects) | 55 | 373 |
| `bunx vitest run` (direct root composition) | 55 | 373 |
| `bunx turbo test --filter=server` | 25 | 109 |
| `bunx turbo test --filter=client` | 27 | 195 |
| `bunx turbo test --filter=@squadzr/schemas` | 3 | 69 |

The direct root composition matches the Turbo run, and the focused runs match the per-workspace
numbers of the root run. CCC-58 removed the `create-user` (2 tests) and `update-user` (3 tests)
specs together with their use cases, so the server unit suite has 5 fewer tests than before that
change. It added and removed no integration tests: `bun run test:integration` in `server/` ran
16 files / 202 tests at the CCC-58 recount and 19 files / 211 tests at CCC-59, both historical. The
current run passes 25 files / 231 tests (measured 2026-10-22 against the test PostgreSQL on port
5433): the 23 files / 227 tests row plus CCC-74's `tests/integration/auth-session-cookie.test.ts`
(+1 file / +3 tests, added after that recount) and CCC-88's
`tests/integration/catalog-migration.test.ts` (+1 file / +1 test) for the catalog migration. CCC-59
removed the `types:unit` project (1 file, 1 test) together with the `@squadzr/types` workspace. The
schemas suite measures 69 tests, not the 74 recorded by the CCC-58 recount; this ticket does not
touch `packages/schemas`, so that drift predates CCC-59 and is corrected here.

### Historical record (CCC-28, 2026-09-25)

The table below is the CCC-28 measurement, kept for traceability; it is not the current
inventory. Recorded on 2026-09-25 (review round), Bun 1.3.8, Vitest 2.1.9, Windows:

| Command | Test files | Tests |
| --- | --- | --- |
| `bun run test` (root, all projects) | 13 | 50 |
| `bunx vitest run` (direct root composition) | 13 | 50 |
| `bunx turbo test --filter=server` | 10 | 39 |
| `bunx turbo test --filter=client` | 1 | 3 |
| `bunx turbo test --filter=@squadzr/schemas` | 1 | 6 |
| `bunx turbo test --filter=@squadzr/types` | 1 | 2 |

At that time the direct root composition matched the Turbo run, the focused runs matched the
per-workspace numbers of the root run, and the server suite had 39 tests / 10 suites with
unchanged test names. Per-suite server counts then: create-room 8, join-room 9, leave-room 4,
delete-expired-rooms 4, get-available-rooms 3, get-my-rooms 2, get-room-by-code 2, create-user 2,
get-user 2, update-user 3 (the create-user and update-user specs were removed by CCC-58).

To re-verify after changes: run `bun run test`, `bunx vitest run`, and each
`bunx turbo test --filter=<workspace>` above, then compare the `Test Files` / `Tests` summaries
with the current counts table.
`bun run test:watch` runs the same composition in watch mode; in non-interactive terminals
(piped output) it executes the suite once, which is how the script is verified. Server project
membership is visible in verbose output: `bun run test --reporter=verbose` inside `server` tags
every line with `|server:unit|`.
