# Test inventory

Canonical runner for every workspace: **Vitest**. `bun test` is no longer a test entry point; Bun
remains the package manager and the server runtime.

## Commands

| Purpose                        | Command                                             |
| ------------------------------ | --------------------------------------------------- |
| Full suite (single root entry) | `bun run test` (delegates to `turbo test`)          |
| Direct root composition        | `bunx vitest run` (composes `vitest.workspace.ts`)  |
| Root watch composition         | `bun run test:watch` (same composition, watch mode) |
| Focused workspace run          | `bunx turbo test --filter=<workspace>`              |
| Direct workspace run           | `bun run test` inside the workspace directory       |

`vitest.workspace.ts` composes the three projects by pointing at each workspace directory, whose own
`vitest.config.ts` stays the single source of truth (see
https://v2.vitest.dev/guide/workspace). Focused and direct runs execute the exact same script
Turbo executes for the root command, so the root suite and the focused suites always share one
inventory (see the equivalence proof below).

## Projects

| Workspace                    | Vitest project       | Environment | Include pattern                                   | Suites | Tests |
| ---------------------------- | -------------------- | ----------- | ------------------------------------------------- | ------ | ----- |
| `server`                     | `server:unit`        | `node`      | `src/**/*.spec.ts`                                | 29     | 160   |
| `server`                     | `server:integration` | `node`      | `tests/integration/**/*.test.ts`                  | 29     | 294   |
| `client`                     | `client:unit`        | `jsdom`     | `src/**/*.spec.{ts,tsx}`, `scripts/**/*.spec.mjs` | 81     | 747   |
| `@squadzr/schemas`           | `schemas:unit`       | `node`      | `src/**/*.spec.ts`                                | 4      | 98    |
| `@squadzr/typescript-config` | —                    | —           | —                                                 | —      | —     |

Suites are test files. The counts above are the current inventory, recounted on 2026-10-25 on the
merged tree after CCC-89, CCC-90, CCC-92, CCC-93, CCC-94, CCC-95, CCC-96, CCC-98, CCC-104 and CCC-105. CCC-104 puts `memberPreview` on every Squad and orders the roster: it adds `tests/integration/member-preview.test.ts` (+1 file / +9 tests: the preview on the list, the single read for non-members and members, My Squads, `POST /api/rooms` with `room_created`, and `room_snapshot`, with its content, the limit of five and the order), the contract cases in `schemas:unit` (+8), the use-case, projection and ordering cases in `server:unit` (+5), and updates the client fixtures without adding client tests. CCC-90 adds the
IGDB adapter suite (`igdb-game-catalog-source.spec.ts`, +1 file / +10 tests, with a recorded IGDB
page as fixture) and the import environment suite (`catalog-import-env.spec.ts`, +1 file / +9
tests), plus one curated-id case in `curated-games.spec.ts` (+1). It adds no integration suite: the
adapter runs with a stubbed `fetch` and needs no database or IGDB credentials. It does add one
invalid-summary case to `tests/integration/catalog-import.test.ts` (+1 test).

CCC-94 moves the client onto the game summary every Squad carries: the full-list games hooks and the
games map are gone, the game-list stubs leave the board, My Squads and Lobby flow specs, and the flow
tests now cover cards and both searches from `squad.game`, the Lobby before and after a snapshot, the
invite preview and the landing showcase. It adds no suite files and removes none; `client:unit` gains
2 tests (479 → 481). CCC-93 extends `tests/integration/games-http.test.ts` with the game search and the delisted
single-game read, and `tests/integration/rooms-http.test.ts` with the 2/40/41 Squad-size bounds and
the delisted-game rejection; it also adds the game-list dismissal (including a case that mirrors
Next's `document` root for Escape), toggle, selection and live-region cases to the client
create-Squad flow, and the search-announcement strings to the message-file spec. It adds no suite
files. CCC-92 adds `tests/integration/squad-game-summary.test.ts` (+1 file / +4 tests), one
projection case and one create-path case in `server:unit` (+2), and three contract cases in
`schemas:unit` (+3); it adds no client tests. CCC-95 adds tests to each suite it touches: the legacy
notification payload contract case and the game-cover payload case in `schemas:unit` (+2), the
builder cover/omission cases and the join use-case cover flow in `server:unit` (+3), the covered and
uncovered menu renderings in `client:unit` (+2), and the cover over HTTP and the realtime channel in
`server:integration` (+2). CCC-89 removed the child-process `games-seed` suite with the static seed,
moved `games-postgres` to the IGDB-id upsert, added the Catalog Import suites (fake source against
an isolated PostgreSQL, plus the entry's exit code and pool close) and added
`src/interface/catalog/curated-games.spec.ts`; that recount also corrected the client and schemas
rows, which had drifted since CCC-70.

CCC-96 adds `tests/integration/popular-games-http.test.ts` (+1 file / +10 tests) for the landing's
popular games endpoint: ranking, the Featured fallback, expired and Ready Squads, the top-tag
tie-break, `totalGames` and the `limit` bounds. It also replaces the landing's full-list and
random-pick client cases with the popular read in `games.spec.ts` (−2) and adds the FAQ
no-fixed-count and IGDB-credit cases to `messages.spec.ts` (+2), so on the merged tree `client:unit`
measures 58 files / 481 tests; the popular read also adds the client assertions in
`landing.spec.tsx`, which keeps its 9 tests.

CCC-98 keeps the game selector's previous results while the next term loads and cancels superseded
searches. It adds 4 create-Squad flow cases (the first term's results stay listed until the next
answer replaces them with no visible loading copy, the empty copy waits for a settled response, the
superseded request's signal aborts, and a warm term answers from the cache without another request)
and 3 `api` cancellation cases (the signal reaches `fetch`, an aborted call rejects with its abort
error rather than a contract error, and calls without a signal stay unchanged). It adds no suite
files, so `client:unit` measures 58 files / 489 tests on the merged tree (CCC-105 added the Lobby's
"Offline · X ago" case).

CCC-101 adds the Redesign v2 motion base with three client suites: `use-reduced-motion.spec.tsx` (3
tests, the preference and its changes), `reveal.spec.tsx` (6 tests, the in-view reveal, its viewport
margin and its final state under reduced motion) and `reduced-motion.spec.ts` (11 tests, the
properties the reduced-motion block keeps in transitions and the loops it removes). `client:unit`
measures 61 files / 509 tests on the merged tree (CCC-105 added the Lobby offline-time case).

CCC-109 puts the Redesign v2 Squad card on the board and adds one client suite, `avatar-rail.spec.ts` (8 tests: the rail formula for 3/5, 5/5, 3/10, 8/10, a preview shorter than the count, the preview order, a smaller squad and a count above the maximum). It rewrites `squad-card.spec.tsx` against roles and names (11 tests before, 21 after: no entrance animation, layout and tags, the member link, the non-member join, the full state, the poster fallback, the preview avatars with their image fallback, and the rail circles counted by kind: member, neutral filled circle and vacant), so the card adds 1 file / 18 tests to `client:unit`. It also rewrites the card assertions in `squad-board.spec.tsx` and `landing.spec.tsx` without changing their test counts. The totals below were recounted by CCC-106 and include it, CCC-102 and CCC-103.

CCC-111 rebuilds the member Lobby and rewrites `squad-lobby.spec.tsx` and `squad-lobby-page.spec.tsx` against roles, names and text (the tooltip and `.rounded-xl` assertions go). It adds a `copy-swap.spec.tsx` suite (4 tests) and 12 cases to `squad-lobby.spec.tsx` plus 1 to `squad-lobby-page.spec.tsx` (the first snapshot of the next Squad on a warm-cache switch does not animate) (the cover and header actions, the `02/03` counter, the server order with the "you" marker and open slots, online and away tiles, paging above eight members, the first snapshot without animation and a later member entering, the reduced-motion entrance, the code and link copy feedback, "End squad" and "Team closed", no replayed entrance when paging away and back, and Presence frozen while reconnecting), so `client:unit` measures 79 files / 717 tests on this branch.

CCC-106 moves the app pages into the sidebar shell and recounts `client:unit` at 77 files / 668 tests on
the merged tree, with CCC-109 (the row had not been recounted since CCC-101, so the difference also holds
CCC-102, CCC-103, CCC-104 and CCC-109's client work). It adds two suites, `src/test/app-layout.spec.tsx`
(+6 tests: the `(app)` layout's server render with and without a session, no footer, and the My Squads
visitor redirect in the proxy) and `src/test/sidebar-flows.spec.tsx` (+34 tests: the squad
count from the board's cache and its refresh on focus and navigation, "Create squad" on the board and in
the Lobby, a visitor's create prompt, `?create=1`, the visitor and signed-in `?join=`, the code form,
the language switch, the drawer's keyboard behaviour, the one bell and the warm-cache navigation board
→ Lobby → board → Lobby) and rewrites `app-shell.spec.tsx` (9 tests: the logos, the All squads link and its current item,
the notification link, the title, and the account button and the visitor sign-in; the server HTML cases live in
`app-layout.spec.tsx`), `session.spec.tsx`, `notifications.spec.tsx`,
`use-sign-out.spec.tsx` and `language-toggle.spec.tsx` for the sidebar and the top bar. The harness
gains a `shell` option, and the capability-boundaries spec accepts a capability's `server` entry.

CCC-107 moves My Squads into the sidebar and removes `/squads/my`, and recounts `client:unit` at 79 files / 712 tests on the tree rebased onto the merged Squad Board and Lobby. It deletes `my-squads-page.spec.tsx` (the page, its tabs and filters) and the proxy block of `app-layout.spec.tsx`, rewrites `my-squads.spec.tsx` as the sidebar's flows (12 tests, 3 of them the realtime refresh by another member's join, by the last slot filling, and the silence for a squad the viewer is not in; the other 9: the merged, deduplicated, newest-first order, the current item, the host crown, the amber count, the Ready state with its Discord tone on the meter, the visitor's sign-in call to action, the browser read, the focus refresh and the refresh after a join), adds `[code]/page.spec.ts` (4 tests: `/squads/my` in three cases and the `/rooms/my` redirect end in a 404) and three `app-layout.spec.tsx` tests (the list in the first HTML, no read for a visitor, a failed server read left to the browser), swaps the create-squad flow from My Squads to the sidebar, and drops the `/squads/my` cases from `next-config.spec.ts` (the `/rooms/my` redirect and the lookahead are gone; both URLs end in the Lobby route's not-found) and from `bundle-limits.spec.mjs` (the `/squads/my` budget entry). The old `SquadFilters` component and its `squads.filters.*` copy, left unused by the new board, are deleted; they had no spec.

CCC-113 turns the create dialog into the three-step wizard and moves `create-squad.spec.tsx`,
`dialogs.spec.tsx`, `my-squads.spec.tsx`, `sidebar-flows.spec.tsx` and `squads-page.spec.tsx` to the
step flow. It adds one suite, `step-panel.spec.tsx` (the transition classes), and 20 tests to
`client:unit` (712 → 732): Continue gating on the game step and the details and invite errors, the
popular games and their heading, the highlighted match with genre and size, the initials tile, the
empty state without a suggest link, reopening the closed list, going back and forward, Cancel, and
the full-screen layout with the pinned footer, plus Escape on step 2 after a keyboard Continue and
with focus outside the search, the horizontally clipped slide, the two-line step labels, the bounded game list on a phone, and the keyboard-only scroll of
the highlighted option. The chevron case and the old route-animation case are gone with their
code.

CCC-108 restyles the notifications panel and recounts `client:unit` at 81 files / 747 tests. It adds
`src/components/ds/notification-item.spec.tsx` (7 tests: the name, message and game with the time,
the unread name and dot, a read row and its grayscale cover, the placeholder without a cover, open and
dismiss with the dismiss label naming the Squad, and the dismiss button on focus), rewrites
`notifications.spec.tsx` against the new panel (15 tests: open, the panel code loaded on idle with the Popover trigger and the focus kept, the unread dots, the 9+ badge cap, the
empty state, the bottom sheet below 640px, mark one, mark all, dismiss, the three failures, cover and no
cover) and adds one `sidebar-flows.spec.tsx` case (the bell's place held in the page header). The other
shell bell cases changed only in the bell's accessible name.

CCC-91 adds no suites and no tests: it brings the already-tested Catalog Import to Railway with a
Railway Infrastructure as Code authoring file and an operations runbook, so the counts above stand.

The CCC-88 recount (2026-10-22) added `tests/integration/catalog-migration.test.ts` and recorded
`server:integration` at 25 files / 231 tests. The CCC-70 recount added `src/env.spec.ts`,
`src/lib/router-history.spec.ts` and `scripts/bundle-report.spec.mjs` to `client:unit`, corrected
the server and client unit rows that had drifted since the 2026-10-09 recount, and corrected the
`server:integration` row, which had drifted since CCC-59. The CCC-28 numbers are kept as a
historical record in the equivalence proof below.

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

- `server:unit` — 160 tests across 29 spec files as of 2026-10-25 (merged tree, CCC-89, CCC-90,
  CCC-92, CCC-93, CCC-95, CCC-104 and CCC-105, whose 7 cases cover the Presence tracker's offline time,
  clearing and removal). CCC-58 removed the `create-user` (2 tests) and `update-user` (3 tests)
  specs together with their use cases. The CCC-28 baseline of 39 tests across 10 specs is historical; see
  the equivalence proof below. CCC-90 adds the IGDB adapter and Catalog Import environment suites.
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
  applies the defaults. `games-http` (CCC-93) covers the Listed-only search, prefix/popularity
  ranking, wildcard escaping, the `limit` bounds and the delisted single-game read; `rooms-http`
  covers the 2–40 Squad-size bounds and the `INVALID_GAME` rejection for a delisted Game.
  `popular-games-http` (CCC-96) drives `GET /api/games/popular`: open-Squad ranking, the Featured
  fallback on a quiet day, expired and Ready Squads excluded, the top-tag tie-break, `totalGames`
  and the 1–20 `limit` bounds.
  `catalog-import` (CCC-89) drives the use case with a fake Game Catalog Source against an isolated
  PostgreSQL: first run, idempotent re-run, update with a slug change, delist and relist, both
  safety stops and the override, mid-run rollbacks of new and existing rows, concurrent runs
  serialized by the import lock, every squad-size rule, featured ranks, legacy rows and dropped
  duplicates. `catalog-import-entry` runs the real entry function on its own isolated database and
  asserts the exit code, the single structured summary and that the database pool closed; it spawns
  no child process. `squad-game-summary` (CCC-92) asserts every Squad response and realtime message
  carries its Game summary, including a Squad on a legacy Game, and counts repository reads to prove
  the Game is joined in the same query as the Squad. `member-preview` (CCC-104) asserts the member preview on the board, the single Squad read, My Squads, the create response, `room_created` and `room_snapshot`: host first, then join time, at most five, no full roster and no invite on public surfaces, and the roster of the member read and the snapshot in the same order.
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

## Equivalence proof (CCC-28, CCC-58, CCC-59, CCC-89, CCC-90, CCC-92, CCC-93, CCC-94, CCC-95, CCC-96, CCC-98, CCC-104, CCC-105)

### Current counts (recounted 2026-10-25 on the merged tree, CCC-89, CCC-90, CCC-92, CCC-93, CCC-94, CCC-95, CCC-96, CCC-98, CCC-101, CCC-104 and CCC-105)

| Command                                                             | Test files | Tests |
| ------------------------------------------------------------------- | ---------- | ----- |
| `bun run test` (root, all projects; sum of the three unit projects) | 113        | 990   |
| `bunx vitest run` (direct root composition)                         | 113        | 990   |
| `bunx turbo test --filter=server`                                   | 29         | 160   |
| `bunx turbo test --filter=client`                                   | 80         | 732   |
| `bunx turbo test --filter=@squadzr/schemas`                         | 4          | 98    |

The direct root composition matches the Turbo run, and the focused runs match the per-workspace
numbers of the root run. CCC-58 removed the `create-user` (2 tests) and `update-user` (3 tests)
specs together with their use cases, so the server unit suite has 5 fewer tests than before that
change. It added and removed no integration tests: `bun run test:integration` in `server/` ran
16 files / 202 tests at the CCC-58 recount and 19 files / 211 tests at CCC-59, both historical. The
current run passes 29 files / 294 tests (measured 2026-10-25 against the test PostgreSQL on port
5433): the CCC-88 row of 25 files / 231 tests plus CCC-89's changes — the 2 child-process seed
tests removed with the static seed, the Catalog Import suites (+2 files / +16 tests), two extra
IGDB-id cases in `games-postgres` — plus CCC-93's cases in the existing games and rooms HTTP suites
(search, delisted-game and Squad-size), CCC-95's 2 cover cases in the existing notification
suites, CCC-92's `squad-game-summary` suite (+1 file / +4 tests) and CCC-90's invalid-summary case
in `catalog-import.test.ts` (+1 test) and CCC-105's `offlineSince` cases in
`realtime-disconnects.test.ts` (+5 tests: the close time after the grace, kept for a later snapshot,
cleared on reconnect, removed with the Membership, `null` when never seen). The `server:unit` row had
drifted to 26 files / 119 tests since CCC-70, so the CCC-89 recount corrected it to 27 files / 122
tests with `curated-games.spec.ts` (+1 file / +3 tests); CCC-93 adds its create-room delisted-game
cases, CCC-95 adds 3 cover cases and CCC-92 adds one projection case and one create-path case, and
CCC-90 adds the IGDB adapter (10 tests) and import environment (9 tests) suites plus one curated-id
case, CCC-104 adds 5 more and CCC-105 adds 7 Presence tracker cases, so the merged tree measures 29 files / 160 tests. CCC-59 removed the `types:unit` project (1
file, 1 test) together with the `@squadzr/types` workspace. The schemas suite measures 98 tests across
4 files (CCC-89 corrected a drift to 76, CCC-93 added the game genre, cover-thumbnail and games-query
contract cases, CCC-95 added 2, CCC-92 added 3, CCC-104 added 8 and CCC-105 added 6: presence with an ISO
time, with `null` and without it, and protocol version 3), and the client suite measures 80 files / 732
tests (CCC-111 added 17 Lobby and copy-swap cases; CCC-106 recounted it on the merged tree, adding 2 suites and 40 tests; CCC-105 added the Lobby's offline-time case; CCC-89 corrected a drift to 465, CCC-93 added its create-Squad flow cases, CCC-94 added 2,
CCC-95 added 2, CCC-92 added none, CCC-96 replaced the landing's random-pick cases with the
popular read and added the FAQ and IGDB-credit cases: net 0, and CCC-98 added 7 cancellation and
placeholder flow cases, and CCC-101 added 20 motion-base cases in 3 files); both drifts predate CCC-89 and were
corrected by its recount. CCC-96's 10 popular-games cases plus CCC-90's invalid-summary case are the
difference between the CCC-95 row of 27 files / 269 tests and the 28 files / 280 tests measured before CCC-104, whose member-preview suite adds 1 file / 9 tests (29 files / 289), and CCC-105's 5 `offlineSince` cases (29 files / 294).

### Historical record (CCC-28, 2026-09-25)

The table below is the CCC-28 measurement, kept for traceability; it is not the current
inventory. Recorded on 2026-09-25 (review round), Bun 1.3.8, Vitest 2.1.9, Windows:

| Command                                     | Test files | Tests |
| ------------------------------------------- | ---------- | ----- |
| `bun run test` (root, all projects)         | 13         | 50    |
| `bunx vitest run` (direct root composition) | 13         | 50    |
| `bunx turbo test --filter=server`           | 10         | 39    |
| `bunx turbo test --filter=client`           | 1          | 3     |
| `bunx turbo test --filter=@squadzr/schemas` | 1          | 6     |
| `bunx turbo test --filter=@squadzr/types`   | 1          | 2     |

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
