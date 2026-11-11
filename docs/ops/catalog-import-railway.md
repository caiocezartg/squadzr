# Catalog Import on Railway

The Catalog Import runs as the `games-import` cron service of the `squadzr` Railway project, in the
`production` environment. One run a day brings the hosted Game Catalog in line with IGDB. The API
runs next to it as the `api` service and owns the schema migrations (see "The `api` service").

## Project and services

|                |                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Project        | `squadzr`                                                                                                                                |
| Environment    | `production` (the only one; it was called `staging` until #133)                                                                          |
| Database       | `postgres`, PostgreSQL 16 (`ghcr.io/railwayapp-templates/postgres-ssl:16`), volume `postgres-data` mounted at `/var/lib/postgresql/data` |
| API service    | `api`, deployed from `caiocezartg/squadzr` branch `main`, at `https://api.squadzr.app`                            |
| Cron service   | `games-import`, deployed from `caiocezartg/squadzr` branch `main`                                                                        |
| Config as code | `.railway/railway.ts` (Railway Infrastructure as Code)                                                                                   |

The authoring file owns the whole environment: the build installs the Bun workspace from the
repository root (`bun install --frozen-lockfile`), the start command runs the import from `server/`
(`bun --no-env-file src/interface/scripts/import-games.ts`), and the schedule is `0 4 * * *`
(04:00 UTC every day). Watch patterns are limited to `server/**` and `packages/**`, so client-only
changes never deploy or run the import. Railway runs cron schedules in UTC.

Besides the games pages, each run calls IGDB's `popularity_primitives` endpoint once per batch of
250 candidates to read the Playing and Steam Peak signals behind the stored popularity: about 7
extra requests at the current catalog size (each batch is paged, so a batch past 500 rows costs one
more), through the same pacer (4 requests per second) and retry as the games pages. The run still
uses one Twitch token and no new variable.

It uses Railway Infrastructure as Code rather than the older Config as Code (`railway.json` with a
per-service config path): Railway deprecated Config as Code, new services cannot opt in, and the
files stop being read on 2026-12-01. Infrastructure as Code is the supported replacement and keeps
the same settings in the repository.

PostgreSQL is pinned to major version 16 to match the `postgres:16-alpine` service the integration
suite runs against. Railway's PostgreSQL template already ships 18, so the service uses the 16 tag of
the same image.

## Run history

Every run is recorded as a Catalog Import Run in the `catalog_import_runs` table, and admins read the
history on the panel's Catalog page and the last run on its Overview, so a night's outcome no longer
needs the Railway logs. The cron claims the run slot as `scheduled`, writes its outcome (`succeeded`
with the counts, `safety_stop` or `failed` with the error message) in statements outside the import's
transaction, and keeps its exit code: `0` on success, `1` on a safety stop or a failure.

**The cron skips while a run is active.** At most one run is `requested` or `running` at a time. When
the slot is taken the cron logs `Catalog Import skipped: another run is requested or running`, exits
`0` and records nothing (a skipped night is not a failure, so Railway does not report `CRASHED`). A run
abandoned by a crash or a deploy frees the slot by itself: before every claim, a `running` run whose
heartbeat (written every 30 seconds) is older than 2 minutes, or a `requested` run nobody claimed
within 10 minutes, is marked `interrupted`.

## Manual run from the panel

An admin or the owner can run the same import from the Catalog page's Import runs tab, at most once
every 24 hours (every manual request counts, failed and interrupted ones included; the cron never
does). The API only queues the run (`POST /api/admin/catalog-import/runs`, no body); an executor
inside the API starts it right away and on a 15-second poll, so a run requested just before a restart
still starts after it, and runs it through the same recorder as the cron, without the fraction-check
override (that stays the cron's alone).

The API needs the IGDB credentials for this. They are optional: without `IGDB_CLIENT_ID` and
`IGDB_CLIENT_SECRET` the API boots normally and the request answers 503 `CATALOG_IMPORT_UNAVAILABLE`.
Set the same two variables (and, if you changed them for the cron, `IGDB_POPULARITY_THRESHOLD` and
`IGDB_HYPE_THRESHOLD`) on the API service to turn it on; the cron service keeps its own copy.

## Apply a config change

The Infrastructure as Code engine ships in the Railway CLI, so use version 5.42.1 or newer
(`railway --version`); older CLIs stop with an upgrade error. `railway upgrade` replaces the binary.

Link the repository once, then plan before applying:

```sh
railway link --project squadzr --environment production
railway config plan --detailed-exit-code
railway config apply --yes
```

`plan` only reads Railway and prints the changes; review them before `apply`. With
`--detailed-exit-code` it exits 0 when the environment matches the file and 2 when changes are
pending, which is how CI can gate on drift. A config change does not need a code push: `config
apply` changes the service settings and redeploys it. The `railway/iac` package requires Railway
CLI 5.42.1 or newer for `config plan` and `config apply`.

Code pushes to `main` (the promotion pull request from `development`) deploy `games-import` through its deployment trigger, once the push's
GitHub checks pass (`checkSuites: true`, "Wait for CI" in the dashboard); the watch patterns drop
pushes that touch only `client/`. `config apply` sets the source but does not create the trigger:
Railway creates it when the repository is connected in the dashboard (service → Settings → Source
Repo), which needs the Railway GitHub App installed with access to `caiocezartg/squadzr`. Check it
with:

```sh
railway api 'query { deploymentTriggers(projectId: "<project id>", environmentId: "<production id>", serviceId: "<games-import id>") { edges { node { branch checkSuites } } } }'
```

An empty list means pushes do not deploy, and the cron keeps running the last deployed commit.

Never assume the plan is clean: if it ever shows a variable to delete, stop and read the variable
names before applying, because a typo in the authoring file or a space in a dashboard-created key
turns into a deletion. The two credentials are deliberately absent from the authoring file's values
and only their names appear there.

## Variables

The service receives exactly three variables:

| Variable             | Value                                                             |
| -------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`       | `${{postgres.DATABASE_URL}}`, a reference to the Postgres service |
| `IGDB_CLIENT_ID`     | Twitch application client id (owner-set)                          |
| `IGDB_CLIENT_SECRET` | Twitch application client secret (owner-set)                      |

Set the two credentials in Railway under `squadzr` → `production` → `games-import` → Variables. A
variable change redeploys the service; the next cron run uses the new values. The names are exact:
a key entered as ` IGDB_CLIENT_ID` (leading space) is a different variable, so the import still reads
`IGDB_CLIENT_ID` as undefined and the run exits 1 with `Invalid catalog import environment
variables … expected string, received undefined`. That mistake happened once while setting the
owner's credentials; check the key names in the Variables tab when a run fails that way.

`IGDB_POPULARITY_THRESHOLD`, `IGDB_HYPE_THRESHOLD` and `CATALOG_IMPORT_OVERRIDE_FRACTION_CHECK` stay
unset, so the import uses its defaults (rating threshold 50, hype threshold 50, fraction check on).
`IGDB_HYPE_THRESHOLD` is the minimum IGDB `hypes` that lets a game released in the last 180 days
enter the catalog before it reaches the rating threshold; `0` means no hype floor among the games
that have `hypes`, and a release without `hypes` enters only through the rating count. A game that
is still under the rating threshold 180 days after its release leaves the catalog on the next run,
as any delisted game does. The popularity formula does not change, but the stored values shift a
little when the candidate list grows or shrinks, because each game's percentile is computed among
the candidates of that run. The credentials live only in Railway: rotate them in the Twitch
developer console and update the two variables; never commit them. Railway's own platform
variables are injected by the platform and are not user configuration.

The Postgres service's `POSTGRES_PASSWORD` is `preserve()`d by the authoring file: the owner sets it
once in Railway and no secret enters the repository.

## Trigger a run by hand

Link the repository once, then trigger the cron service:

```sh
railway link --project squadzr --environment production
railway cron run --service games-import --yes
```

The run shows up in `railway cron list` next to the scheduled ones:

```sh
railway cron list --service games-import
```

`EXITED` means the process finished (the service still exits non-zero on a failed import, which
Railway reports as `CRASHED`); `previous run still running` means Railway skipped a run because the
previous one had not exited. Use `railway cron run` for a one-off after a migration or a catalog
change; the daily schedule is unaffected.

## Read the summary

A successful run logs one JSON object on a single line and exits `0`. `railway logs` renders that
object as `key=value` fields, so the first hosted run (2026-10-24) reads:

```text
[INFO] created=1675 updated=0 delisted=0 relisted=0 received=1675 dropped=0 invalid=0 durationMs=3873.87
```

The same line is `{"created":1675,"updated":0,"delisted":0,"relisted":0,"received":1675,"dropped":0,"invalid":0,"durationMs":3873.87}`
before Railway formats it. `received` counts the candidates IGDB returned (duplicates included),
`dropped` is the duplicates ignored within the run, `invalid` is the candidates the source discarded
for a missing field, and `created`/`updated`/`delisted`/`relisted` describe the catalog writes. A
failed safety check or a failed write logs the error instead, changes nothing (the run is one
transaction) and exits `1`.

A second run straight after the first is the cheapest persistence check: it reports
`created=0 updated=1675` instead of `created=1675`, which proves the previous run's rows are still in
the database.

```sh
railway logs --service games-import --deployment --lines 200
```

`railway cron list` prints a ready-to-run `railway logs --since … --until …` command for the latest
completed run, which is the cleanest way to read one run without the neighbouring noise.

## Narrow the catalog on purpose

The default run refuses to shrink the catalog below half of today's Listed Games, and always refuses
fewer than 10 candidates. To deliberately narrow it, raise `IGDB_POPULARITY_THRESHOLD` and bypass
only the fraction check for that run. Set both keys in one call so Railway redeploys once with both
values:

```sh
railway variable set IGDB_POPULARITY_THRESHOLD=120 CATALOG_IMPORT_OVERRIDE_FRACTION_CHECK=true \
  --service games-import
```

Raising only `IGDB_POPULARITY_THRESHOLD` still lets in the games released in the last 180 days that
pass `IGDB_HYPE_THRESHOLD`. To cut those too, raise `IGDB_HYPE_THRESHOLD` as well (for example to 100) in the same call.

Wait for the redeploy that the change triggers before starting a run:

```sh
railway deployment list --service games-import
```

The newest entry must read `SUCCESS`. A `cron run` started while the previous deployment is still
active runs on that deployment without the new values, so the guard refuses with exit 1 even though
the variables are set. Only then trigger the run:

```sh
railway cron run --service games-import --yes
```

Removing the override also redeploys, and a run made before that deployment finishes still sees the
override:

```sh
railway variable delete CATALOG_IMPORT_OVERRIDE_FRACTION_CHECK --service games-import
railway deployment list --service games-import   # wait for the newest entry to read SUCCESS
```

If you need several variable edits without one redeploy each, pass `--skip-deploys` to the `set`
and `delete` calls and finish with a single `railway redeploy --service games-import`, then wait for
that deployment the same way.

The override never bypasses the absolute floor, and the import is idempotent: re-running with the
previous thresholds brings the dropped games back as `relisted`.

## Backups (known limitation: not enabled)

**Volume backups are not enabled.** Railway sells volume backups as part of Pro workspaces; this
workspace is Hobby, and both the dashboard and the API refuse to schedule a backup for
`postgres-data`. The volume is therefore unprotected: losing it loses the hosted catalog. That loss
is recoverable without a backup because the import rebuilds the catalog from IGDB on the next run,
but nothing else stored in this database would survive.

After the workspace moves to Pro, enable the Daily schedule in the `postgres` service's Backups tab
(Railway keeps daily backups for 6 days) and confirm it from the schema instead of the dashboard:

```sh
railway api 'query { volumeInstanceBackupScheduleList(volumeInstanceId: "<volume-instance-id>") { kind cron retentionSeconds } }'
```

`railway volume list --json` names the volume (`postgres-data`) and its volume instance id; the Daily
entry must be listed for the backup requirement to hold.

## The `api` service

The `api` service runs the Fastify server (`cd server && bun --no-env-file src/index.ts`) from the same
repository, built with `bun install --frozen-lockfile`. It is reachable at `https://api.squadzr.app`
(a proxied CNAME in Cloudflare, SSL mode Full (strict), see "The edge" below); `/health/ready` is its health
check, and a deployment that does not answer it never takes traffic.

- **Deploys.** A push to `main` deploys it only after the push's GitHub checks pass (`checkSuites`),
  and only when it touches `server/**`, `packages/**`, `package.json` or `bun.lock`: a push that touches
  only `client/` does not. `development` is the pre-test branch: it is not deployed, and reaches production only through the promotion pull request.
- **Failed migration.** The pre-deploy command (`bun --no-env-file src/interface/scripts/migrate.ts`)
  runs before the new container starts. If it exits non-zero the deployment fails and the previous
  one keeps serving.
- **Draining.** `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=60` gives SIGTERM time to close sockets and let a
  running manual Catalog Import finish.
- **Limits.** `api` and `postgres` are capped at 1 vCPU and 512 MiB each (`limitOverride`). They are
  ceilings: Railway bills what the services use.
- **Variables.** `NODE_ENV`, `LOG_LEVEL`, `CORS_ORIGIN`, `BETTER_AUTH_URL`, `BETTER_AUTH_COOKIE_DOMAIN`,
  `TRUST_PROXY_HOPS=2` (Cloudflare, then Railway's edge) and `DATABASE_URL` (a reference to `postgres`) are in the authoring file, and the
  IGDB credentials are references to the `games-import` ones. `BETTER_AUTH_SECRET`, `DISCORD_CLIENT_ID`
  and `DISCORD_CLIENT_SECRET` are `preserve()`d: they exist only in Railway, never in the repository.
  The Discord application needs `https://api.squadzr.app/api/auth/callback/discord` as a redirect URI.

### The edge

`api.squadzr.app` is proxied by Cloudflare (zone `squadzr.app`, Free plan, SSL mode Full (strict): Railway's
Let's Encrypt certificate for the custom domain is what Cloudflare validates). Three things live in the
Cloudflare zone, outside this repository:

- **Transform Rule** (`http_request_late_transform`): on host `api.squadzr.app` it **sets** (overwrites)
  the request header `x-squadzr-edge-auth` to the edge secret, so a client cannot choose it.
- **Rate limiting rule** (`http_ratelimit`, the one the Free plan allows): `/api/auth/sign-in/*` and
  `/api/auth/callback/*` on that host, 5 requests per 10 seconds per IP (the Free plan counts per IP and per
  Cloudflare data center), then blocked for 10 seconds with a 429. `/api/auth/get-session` is not matched:
  the Next server calls it for every visitor from the Worker's few addresses.
- **DNS**: the `api` CNAME is proxied; the `_railway-verify.api` TXT stays DNS-only.

The API reads the secret from the optional `EDGE_AUTH_TOKEN` variable. Set, a request without the matching
`x-squadzr-edge-auth` header gets 403 (`EDGE_AUTH_REQUIRED`), CORS preflights and WebSocket handshakes
included; exactly `/health` and `/health/ready` are exempt, because Railway probes them directly. Unset,
the API behaves as if the lock did not exist, which is how it ships: the variable is set in the ticket that
puts the deployed client behind the same header. The Transform Rule's value and `EDGE_AUTH_TOKEN` must be
changed together, and the Worker's secret with them.

At `LOG_LEVEL=debug` each request logs `Edge request headers` with `edgeAuthHeader` (`present` or `absent`,
never the value) and `cfConnectingIp`.

**Client address.** Railway's edge replaces `x-forwarded-for` with the address that connected to it, so the API
sees Cloudflare's address (`request.ip`), not the visitor's. `TRUST_PROXY_HOPS` does not change that
(measured at 1, 2 and 3 hops). Cloudflare sends the visitor's address as `CF-Connecting-IP`; the debug line above shows whether it arrives.

## Migrations

The pre-deploy command applies the checked-in migrations with the runtime entry point
(`server/src/interface/scripts/migrate.ts`, no `drizzle-kit`) before the import container starts. It
runs against the same `DATABASE_URL` and is safe to run repeatedly.

After a deploy whose migration touches Game Search, such as `0007` (issue #100), run the import with
`railway cron run` or wait for the day's run. The migration backfills `search_text` with
`[:alnum:]`, which does not cover multibyte letters under the `C` locale, so games with Cyrillic or
CJK names stay unsearchable until the import rewrites their rows with `normalizeSearchText`.

The `api` service's pre-deploy command runs them, and `games-import` has none: exactly one service owns
schema changes. The cron therefore runs against whatever schema the last API deploy left, so a code
change that needs a new column deploys the API first.

## Make the first admin

The admin panel (`/admin`) is reserved to people whose role is `moderator`, `admin` or `owner`, and the
first admin comes from a server script, never from the app. It reads only `DATABASE_URL`, like the migration script, and takes
one id: a user id, or else the person's Discord id.

```
cd server
DATABASE_URL=<connection string> bun run admin:grant <user id or Discord id>
```

It is safe to run twice (an existing admin or owner is left alone, with no second audit entry), it never
demotes and it reports an unknown id without writing anything. The grant shows in the panel's Audit page
as done by "System".

### Make the owner

The owner is the one person who also changes admins' roles. Nobody can become the owner from the app;
add `--owner` to the same script:

```
cd server
DATABASE_URL=<connection string> bun run admin:grant --owner <user id or Discord id>
```

There is at most one owner (the database refuses a second): when someone already is the owner, the script
says who and writes nothing. It makes the person the owner whatever role they held and never demotes
anyone.
