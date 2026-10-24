# Catalog Import on Railway

The Catalog Import runs as the `games-import` cron service of the `squadzr` Railway project, in the
`staging` environment. One run a day brings the hosted Game Catalog in line with IGDB; the API is
not hosted yet, so this service is the only hosted consumer of the database.

## Project and services

| | |
| --- | --- |
| Project | `squadzr` |
| Environment | `staging` |
| Database | `postgres`, PostgreSQL 16 (`ghcr.io/railwayapp-templates/postgres-ssl:16`), volume `postgres-data` mounted at `/var/lib/postgresql/data` |
| Cron service | `games-import`, deployed from `caiocezartg/squadzr` branch `development` |
| Config as code | `.railway/railway.ts` (Railway Infrastructure as Code) |

The authoring file owns the whole environment: the build installs the Bun workspace from the
repository root (`bun install --frozen-lockfile`), the start command runs the import from `server/`
(`bun --no-env-file src/interface/scripts/import-games.ts`), the pre-deploy command runs the runtime
migration (`bun --no-env-file src/interface/scripts/migrate.ts`), and the schedule is `0 4 * * *`
(04:00 UTC every day). Watch patterns are limited to `server/**` and `packages/**`, so client-only
changes never deploy or run the import. Railway runs cron schedules in UTC.

It uses Railway Infrastructure as Code rather than the older Config as Code (`railway.json` with a
per-service config path): Railway deprecated Config as Code, new services cannot opt in, and the
files stop being read on 2026-12-01. Infrastructure as Code is the supported replacement and keeps
the same settings in the repository.

PostgreSQL is pinned to major version 16 to match the `postgres:16-alpine` service the integration
suite runs against. Railway's PostgreSQL template already ships 18, so the service uses the 16 tag of
the same image.

## Apply a config change

The Infrastructure as Code engine ships in the Railway CLI, so use version 5.42.1 or newer
(`railway --version`); older CLIs stop with an upgrade error. `railway upgrade` replaces the binary.

Link the repository once, then plan before applying:

```sh
railway link --project squadzr --environment staging
railway config plan --detailed-exit-code
railway config apply --yes
```

`plan` only reads Railway and prints the changes; review them before `apply`. With
`--detailed-exit-code` it exits 0 when the environment matches the file and 2 when changes are
pending, which is how CI can gate on drift. A config change does not need a code push: `config
apply` changes the service settings and redeploys it. The `railway/iac` package requires Railway
CLI 5.42.1 or newer for `config plan` and `config apply`.

Code pushes to `development` deploy `games-import` through its deployment trigger, once the push's
GitHub checks pass (`checkSuites: true`, "Wait for CI" in the dashboard); the watch patterns drop
pushes that touch only `client/`. `config apply` sets the source but does not create the trigger:
Railway creates it when the repository is connected in the dashboard (service → Settings → Source
Repo), which needs the Railway GitHub App installed with access to `caiocezartg/squadzr`. Check it
with:

```sh
railway api 'query { deploymentTriggers(projectId: "<project id>", environmentId: "<staging id>", serviceId: "<games-import id>") { edges { node { branch checkSuites } } } }'
```

An empty list means pushes do not deploy, and the cron keeps running the last deployed commit.

Never assume the plan is clean: if it ever shows a variable to delete, stop and read the variable
names before applying, because a typo in the authoring file or a space in a dashboard-created key
turns into a deletion. The two credentials are deliberately absent from the authoring file's values
and only their names appear there.

## Variables

The service receives exactly three variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `${{postgres.DATABASE_URL}}`, a reference to the Postgres service |
| `IGDB_CLIENT_ID` | Twitch application client id (owner-set) |
| `IGDB_CLIENT_SECRET` | Twitch application client secret (owner-set) |

Set the two credentials in Railway under `squadzr` → `staging` → `games-import` → Variables. A
variable change redeploys the service; the next cron run uses the new values. The names are exact:
a key entered as ` IGDB_CLIENT_ID` (leading space) is a different variable, so the import still reads
`IGDB_CLIENT_ID` as undefined and the run exits 1 with `Invalid catalog import environment
variables … expected string, received undefined`. That mistake happened once while setting the
owner's credentials; check the key names in the Variables tab when a run fails that way.

`IGDB_POPULARITY_THRESHOLD` and `CATALOG_IMPORT_OVERRIDE_FRACTION_CHECK` stay unset, so the import
uses its defaults (threshold 50, fraction check on). The credentials live only in Railway: rotate
them in the Twitch developer console and update the two variables; never commit them. Railway's own
platform variables are injected by the platform and are not user configuration.

The Postgres service's `POSTGRES_PASSWORD` is `preserve()`d by the authoring file: the owner sets it
once in Railway and no secret enters the repository.

## Trigger a run by hand

Link the repository once, then trigger the cron service:

```sh
railway link --project squadzr --environment staging
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
fewer than 10 candidates. To deliberately narrow it, raise the threshold and bypass only the fraction
check for that run. Set both keys in one call so Railway redeploys once with both values:

```sh
railway variable set IGDB_POPULARITY_THRESHOLD=120 CATALOG_IMPORT_OVERRIDE_FRACTION_CHECK=true \
  --service games-import
```

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
previous threshold brings the dropped games back as `relisted`.

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

## Migrations

The pre-deploy command applies the checked-in migrations with the runtime entry point
(`server/src/interface/scripts/migrate.ts`, no `drizzle-kit`) before the import container starts. It
runs against the same `DATABASE_URL` and is safe to run repeatedly.

When the API is hosted on Railway, the migrations move to the API service's pre-deploy command and
the `preDeployCommand` entry leaves this authoring file: exactly one service owns schema changes.
