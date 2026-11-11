# Squadzr

Real-time web app where gamers fill out full teams (premades) for multiplayer games like LoL, Dota, and CS. Turbo + Bun monorepo: `client/`, `server/`, `packages/`.

## Toolchain

Bun is the only package manager and script runner: `bun install`, `bun add`, `bun run <script>`, `bunx <bin>`. CI pins the Bun version from `packageManager` in the root `package.json` and installs with `--frozen-lockfile`, so every dependency change lands together with its `bun.lock` update.

## Scope

The Linear spec issue for the task is the contract. Change only what its decisions and acceptance criteria require, and satisfy every acceptance criterion. When the spec is silent, choose the smallest change that fits the existing code; when the spec conflicts with the code or an ADR, surface the conflict before implementing.

## Code shape

Build small-to-medium units that each own one responsibility and stand on their own: a function does one thing, a module groups one concern. When a unit starts coordinating several behaviours, split it into named pieces and compose them.

## Server architecture

Clean Architecture: dependencies point inward (`interface → application → domain`); `infrastructure` implements domain interfaces.

- Business logic lives in `application/use-cases/` and depends on repository interfaces only.
- `interface/factories/` is the single place where concrete repositories are instantiated and injected.
- `domain/` stays free of framework and database imports.

## Contracts

Validate every external input with Zod. HTTP and WebSocket contracts live in `@squadzr/schemas` and are shared by client and server (see `docs/adr/0001-own-runtime-contracts-in-schemas.md`).

## Definition of done

A task is done when it is **CI-green**: every gate in `.github/workflows/ci.yml` passes locally, with zero errors and zero warnings.

```
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run build
```

When the change touches persistence, repositories, or server wiring, also run `bun run test:integration` in `server/` against `docker-compose.test.yml`. Existing flows keep working: a bug found along the way is fixed at its root cause, in the same task.

Then commit the task on its own (one task, one commit) and report every file created, modified, or removed, with what changed and why.

## Agent skills

### Issue tracker

Squadzr work is tracked as Linear issues in the Squadzr project. See `docs/agents/issue-tracker.md`.

### Triage labels

The canonical triage labels are supplemented with code-area labels. See `docs/agents/triage-labels.md`.

### Domain docs

This monorepo uses a multi-context domain-documentation layout. See `docs/agents/domain.md`.
