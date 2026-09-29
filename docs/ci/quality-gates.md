# CI quality gates and branch protection

Repository-owned GitHub Actions checks (CCC-30). They run from a clean checkout on every pull
request into `development` or `main`, on pushes to those branches, and on manual dispatch. **CI
never deploys.**

## Branch model

| Branch        | Role                                                             | Receives                                        |
| ------------- | ---------------------------------------------------------------- | ----------------------------------------------- |
| `development` | Integration branch                                               | Every task pull request                         |
| `main`        | Release-only branch; Vercel deploys it to Production (see below) | Promotion pull requests from `development` only |

## Stable required-check names

These are the check names branch protection matches on. They are the `name:` of each job and must
not be renamed without updating `.github/rulesets/*.json` and the live rulesets in the same change.

| Check name          | Workflow                                        | What it runs                                                                         | Required on           |
| ------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------- |
| `format-check`      | `CI` (`.github/workflows/ci.yml`)               | `bun run format:check`                                                               | `development`, `main` |
| `lint`              | `CI`                                            | `bun run lint` (ESLint `--max-warnings=0` in every workspace)                        | `development`, `main` |
| `typecheck`         | `CI`                                            | `bun run typecheck`                                                                  | `development`, `main` |
| `unit-tests`        | `CI`                                            | `bun run test` (every Vitest unit project through Turbo)                             | `development`, `main` |
| `integration-tests` | `CI`                                            | `bun run test:integration` in `server/` against a PostgreSQL 16 service              | `development`, `main` |
| `build`             | `CI`                                            | `bun run build` (client and server production builds)                                | `development`, `main` |
| `promotion-source`  | `Promotion` (`.github/workflows/promotion.yml`) | Fails any pull request into `main` whose head is not this repository's `development` | `main`                |

All checks are produced by the GitHub Actions app (`integration_id` 15368), which the rulesets pin
so no other app or commit status can satisfy them.

## How the gates behave

- **Pinned toolchain.** `.github/actions/setup-bun` installs the Bun version from the root
  `package.json` `packageManager` field (`bun@1.3.8`), fails if the runner reports a different
  version, and installs with `bun install --frozen-lockfile`, so a stale `bun.lock` fails every job.
- **Warnings fail.** Prettier `--check` fails on any unformatted file; every workspace lint script
  uses `--max-warnings=0`; `tsc` has no warning level; Vitest fails on any failing test or a
  workspace with no test files.
- **No hidden execution.** Only the Bun download cache (`~/.bun/install/cache`, keyed on `bun.lock`)
  is cached. `TURBO_FORCE=true` disables Turbo cache reads and no remote cache is configured, so
  lint, typecheck, tests, and builds always execute.
- **PostgreSQL 16.** `integration-tests` starts a `postgres:16-alpine` service on port 5433 with the
  same disposable credentials as `docker-compose.test.yml` and points `TEST_DATABASE_URL` at it.
  The harness itself refuses any major version other than 16. On failure, the job prints the
  PostgreSQL container logs; no secrets are used by any job.
- **Least privilege.** `CI` runs with `contents: read`; `Promotion` runs with no token permissions.
- **Known non-blocking output.** The client build prints Vite's "chunks larger than 500 kB" advisory.
  It is a pre-existing baseline item owned by roadmap issue 17 (bundle budgets) and does not fail
  `build` today.

## Required GitHub settings (owner action)

Branch protection is a repository setting, not code. It is configured with repository rulesets
whose exact definitions are versioned in `.github/rulesets/`:

| Ruleset                           | File                                | Target        | Rules                                                                                                                                                                    |
| --------------------------------- | ----------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `development: integration branch` | `.github/rulesets/development.json` | `development` | Require a pull request (0 approvals); require the six `CI` checks; require the branch to be up to date before merging; block force pushes and deletion; no bypass actors |
| `main: release-only promotion`    | `.github/rulesets/main.json`        | `main`        | Require a pull request (0 approvals, merge commits only); require the six `CI` checks plus `promotion-source`; block force pushes and deletion; no bypass actors         |

`bypass_actors` is empty on purpose: repository admins cannot merge a pull request with a failing or
pending required check. `main` does not require "up to date" because promotion merge commits exist
only on `main`; requiring it would force merging `main` back into `development` before each
release. `main` allows only merge commits so `development` and `main` keep a shared history.

Apply them once (requires admin on `caiocezartg/squadzr`):

```sh
gh api --method POST repos/caiocezartg/squadzr/rulesets --input .github/rulesets/development.json
gh api --method POST repos/caiocezartg/squadzr/rulesets --input .github/rulesets/main.json
gh api repos/caiocezartg/squadzr/rulesets   # verify both are listed with "enforcement": "active"
```

Or in the UI: **Settings → Rules → Rulesets → New ruleset → Import a ruleset**, then select each
JSON file. To change a ruleset later, update the JSON here and apply it with
`gh api --method PUT repos/caiocezartg/squadzr/rulesets/<id> --input <file>`.

The API accepts the check names immediately; the UI check picker only lists a check after it has
reported at least once, which the first `CI` run on this pull request provides.

## Demonstrating that `development` blocks a failing check

Documentation alone does not satisfy CCC-30. After applying the rulesets:

1. Branch from `development`, introduce a deliberate failure (for example an unformatted line in a
   `.ts` file), push, and open a draft pull request into `development`.
2. Confirm `format-check` fails and the pull request shows **Merging is blocked** with the merge
   button disabled, including for the repository owner.
3. Record the pull request URL and a screenshot in CCC-30, then close the pull request without
   merging and delete the branch.

To verify the `main` promotion rule, open a pull request from any other branch into `main` and
confirm `promotion-source` fails and merging is blocked.

## Deployment link (Vercel / Railway)

Recorded on 2026-09-29, before any destructive migration in CCC-35:

| Host    | Linked service                                        | Production trigger                                                                                                | Evidence                                                                                                                                                              |
| ------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel  | Client (`client/vercel.json`, `bun run build:client`) | Vercel Git integration: `main` → `Production`, every other branch/PR → `Preview`. Not gated by these checks.      | GitHub deployments API: 14 `Production` deployments (latest `25ae3d1`, the `main` head) and 28 `Preview` deployments by `vercel[bot]`; commit status context `Vercel` |
| Railway | Fastify server and managed PostgreSQL                 | **Unverified.** Railway reports no GitHub deployments or commit statuses and no local project link was available. | Owner must confirm the Railway service's source repo, deploy branch (`main` expected), and whether "Wait for CI" is enabled                                           |

Consequences until roadmap issue 18 (gated automatic delivery):

- Merging a promotion pull request into `main` triggers Vercel Production (and Railway, if it
  auto-deploys `main`). The `main` ruleset ensures that merge only happens after every required
  check passes.
- Vercel `Preview` deployments on task branches are not production and are unaffected.
- The `Vercel` commit status is **not** a required check; it must not become one of the stable
  names above.
