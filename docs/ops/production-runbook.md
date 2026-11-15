# Production runbook

This is the one page to open when something happens in production. It says what to do, in order,
and links to the pages that hold the details.

Squadzr runs in two places:

- **The client** is the Cloudflare Worker `squadzr-web` at `https://squadzr.app`
  ([`client-on-cloudflare-workers.md`](client-on-cloudflare-workers.md)).
- **The API, the database and the daily import** run on Railway, project `squadzr`, environment
  `production`, behind a Cloudflare Tunnel at `https://api.squadzr.app`
  ([`catalog-import-railway.md`](catalog-import-railway.md)).

The reasons for this layout are in
[ADR 0006](../adr/0006-host-on-cloudflare-workers-and-railway.md). There is one environment,
`production`. There is no staging and no Vercel.

Railway commands below need the Railway CLI, linked once from a checkout of the repository:

```sh
railway link --project squadzr --environment production
```

## How a deploy happens

1. A task pull request merges into `development`. **This deploys nothing.**
2. When you want a release, open a promotion pull request `development → main`. Only that pull
   request is allowed into `main` (the `promotion-source` check).
3. CI runs on the pull request. You merge it when every check is green.
4. The merge is a push to `main`. CI runs again on that push.
5. When CI succeeds, two things deploy on their own:
   - **Railway** deploys `api` and `games-import`. Both use "Wait for CI", so Railway waits for the
     push's checks. A push that touches only `client/` deploys neither.
   - **GitHub Actions** runs `deploy-client.yml`. It builds the commit CI tested and deploys the
     Workers `squadzr-web` and `squadzr-og`.
6. Before the new `api` container starts, Railway runs the **migrations** (the pre-deploy command).
   The API owns them. The cron has none.
7. Railway only sends traffic to the new `api` when `/health/ready` answers.

If CI fails, nothing deploys. More: [`docs/ci/quality-gates.md`](../ci/quality-gates.md).

## The site or API is down and nothing was deployed

Check in this order and stop at the first thing that is wrong:

1. Open `https://api.squadzr.app/health`. It skips the edge lock, so it answers 200 whenever the API is up.
2. If it does not answer, check `cloudflared`: `railway logs --service cloudflared --lines 50` and the
   tunnel status calls in [`catalog-import-railway.md`, "The tunnel"](catalog-import-railway.md#the-tunnel)
   (the code block under "Health and checks"). A healthy tunnel has 2 clients and 8 connections.
3. Run `railway status` and look at `api` and `postgres`. If one crashed, `railway restart --service <name>`,
   or `railway redeploy --service <name>` if the restart does not bring it back.
4. Run `railway usage`. At the hard limit Railway has taken everything offline: see
   [Railway hard limit](#railway-hard-limit).
5. Last resort, if the tunnel itself cannot be fixed: serve `api.squadzr.app` from a public Railway domain
   again ([`catalog-import-railway.md`, "The tunnel"](catalog-import-railway.md#the-tunnel), the paragraphs
   "Roll back to a public Railway domain" and "Re-add the public domain").

## Roll back

Roll back first, find the cause after. After any rollback, open `https://squadzr.app`, sign in, and
check that `https://api.squadzr.app/health/ready` answers 200.

Drill done 2026-11-13: both rollbacks were run in production and rolled forward again, one at a time
(API with the command line below, client with `cf`). No request failed. The dashboard clicks were not
used.

Check the result of every rollback with these three, not only `/health/ready`:

- `https://api.squadzr.app/api/games?limit=1` answers 200. It goes through the edge lock, so it fails
  with 403 if the API and Cloudflare disagree about `EDGE_AUTH_TOKEN`.
- `https://squadzr.app/` answers 200 and the landing lists the popular games. The landing hides an
  API failure (it renders without games), so a 200 alone does not prove the Worker reaches the API.
- Sign in with Discord.

### Roll back the API

> **Do not roll back if `EDGE_AUTH_TOKEN` or `BETTER_AUTH_SECRET` changed after the deployment you
> would go back to.** Railway restores that deployment's variables too. The API would come back with
> the old edge token and refuse every request, or a leaked auth secret would be valid again. Use the
> second way below.

To check the edge token without printing it, list the `squadzr-web` deployments with
`cf workers deployments list --worker squadzr-web`. A deployment with the annotation
`workers/triggered_by: secret` is a secret change. If one is newer than the deployment you want, the
token changed after it. Railway keeps no history of variable changes, so for `BETTER_AUTH_SECRET`
the only clue is that no `api` deployment sits between the target and the active one except the one
you know about. The safest target is the previous deployment of the same commit.

1. Open Railway → `squadzr` → `production` → `api` → Deployments.
2. Click the three dots on the last deployment that worked, choose **Rollback**, and confirm.
   Railway restores that deployment's image **and its variables**. Then open `https://squadzr.app`
   and sign in.
3. Rollback **does not undo migrations**. The old code now runs on the new database. If the
   migration removed or renamed something the old code needs, use the second way below instead.

The same step on the command line, which the drill used (the Railway CLI has no rollback command, but
its `api` command reaches the GraphQL API; link the repository first, see the top of this page):

```sh
railway status --json                      # ids of the environment and the services
railway api 'query { deployments(first: 10, input: {projectId: "7ba44a9d-4c58-4075-9b3b-019793ed88d5", environmentId: "<environment id>", serviceId: "<api service id>"}) { edges { node { id status createdAt canRollback meta } } } }'
railway api 'mutation { deploymentRollback(id: "<deployment id>") }'
```

Pick a deployment with `canRollback: true` (a `REMOVED` one is fine, it is only an old one). Rollback
starts a **new** deployment with `meta.reason` `rollback`, built from the old image, so it has a new id.
In the drill it served about 30 seconds later and no request failed: the old container kept serving
until the new one answered `/health/ready`, and was removed about a minute after.

To roll forward again, roll back to the deployment that was active before. It still shows
`canRollback: true`. Compare `meta.commitHash` and `meta.imageDigest` with what you had.

The second way, which is slower: revert the bad pull request on `development` (a new pull request
with `git revert`), merge it, then promote it to `main` as usual.

Source: [Railway, Deployment Actions](https://docs.railway.com/deployments/deployment-actions#rollback).
Railway keeps old deployments only for the time its plan allows. An older one has no Rollback button.

### Roll back the client

1. Open Cloudflare → Workers & Pages → `squadzr-web` → Deployments.
2. Click the three dots on the version to go back to, choose **Rollback**, and confirm.

The same step on the command line, which the drill used. `cf` is a devDependency of `client/` (after
`bun install`, it is in `client/node_modules/.bin`), and `cf auth whoami` shows whether it is signed
in. The repo does not depend on Wrangler, so do not use `wrangler rollback`.

```sh
cf workers deployments list --worker squadzr-web      # newest first: deployment id, date, version id
cf workers deployments create --worker squadzr-web --strategy percentage \
  --versions '[{"version_id":"<version id to go back to>","percentage":100}]'
```

The version ids in the list are the full ids. The second command takes effect at once: in the drill
the site answered 200 on the first probe. To roll forward, run the same command with the version id
that was active before. Cloudflare keeps the last 100 versions.
Source: [Cloudflare, Rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).

**If `EDGE_AUTH_TOKEN` was rotated since the version you go back to,** `cf workers deployments create`
refuses unless you add `--bypass-deployment-checks` (its help text says so; the drill did not test
this, because the token had not changed since the target). Do not bypass it: the old version would
carry the old token and the API would answer 403 `EDGE_AUTH_REQUIRED`. Go back to a version newer than
the rotation, or roll forward with a fix.

If only the invite images are wrong, do the same for `squadzr-og`.

The next promotion deploys the newest `main` again over the rollback. Revert the bad pull request
first, or the bug comes back.

## A failed migration

**What it looks like.** The `api` deployment in Railway fails before it starts. The deployment logs
end with `Migration failed:` and the database error. The new container never starts, so
`/health/ready` is still served by the previous deployment. Visitors notice nothing.

**Why it is safe.** The pre-deploy command is `cd server && bun --no-env-file
src/interface/scripts/migrate.ts` (`.railway/railway.ts`). Railway does not retry it, and a failure
stops the deployment ([Railway, pre-deploy command](https://docs.railway.com/deployments/pre-deploy-command)).
The script runs every pending migration in one database transaction (Drizzle's migrator), so a
failed one leaves the database as it was. The script exits with code 1 on any failure.

**What to do.**

1. Do not roll back. The old version is still serving.
2. Read the error. In the dashboard, open the failed deployment. On the command line,
   `railway deployment list --service api` gives the id, then
   `railway logs <deployment id> --service api --deployment --lines 200`.
3. Fix it forward: a pull request into `development` with a **new** migration or a fix to the
   one that did not apply. Never edit a migration that already ran in production.
4. Promote again.

A migration that hangs does not fail by itself: `.railway/railway.ts` sets no pre-deploy timeout, so
the deployment stays in progress. If it has been running for more than a few minutes, cancel it in
the dashboard and read the logs.

## Backup and restore

**Draft.** The code is in place ([#136](https://github.com/caiocezartg/squadzr/issues/136)); the steps
marked `TODO(#136 verify)` have not been run in production yet. The coordinator verifies them and
removes the marks.

### Set up (once)

The `db-backup` service builds from `main`, so it is created only after the change is there.

1. Merge the change into `main` with the promotion pull request, and wait for CI to pass. If you
   apply before this, the first build fails because `main` has no `ops/db-backup/`.
2. `railway config plan`, read it (it should only create `db-backup`), then `railway config apply`
   (`catalog-import-railway.md`, "Apply a config change").
3. Check the service's deployment trigger with the `deploymentTriggers` query in
   `catalog-import-railway.md`, with the `db-backup` service id. An empty list means later pushes to
   `ops/db-backup/` do not redeploy it: connect the repository in the service's Settings.
   `TODO(#136 verify)`
4. The owner creates the R2 key (R2 → Manage API tokens → Create Account API token, **Object Read &
   Write** on `squadzr-db-backups` only) and sets `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` on
   `db-backup` in the Railway dashboard. The values are never written anywhere else. Also set
   `R2_ENDPOINT` to the bucket's S3 endpoint (R2 → `squadzr-db-backups` → Settings → S3 API, without
   the bucket name at the end). It is not a secret, but it carries the account id, which the public
   repository does not publish.
5. Run a backup by hand (below) and check the dump is in the bucket. `TODO(#136 verify)`

### Where the dumps are

- A Railway cron service, `db-backup`, runs every day at **06:00 UTC** (after the 04:00 UTC Catalog
  Import). It runs `pg_dump --format=custom --no-owner --no-acl` with a PostgreSQL 16 client and
  uploads the file with the AWS CLI. The code is in `ops/db-backup/`; the service is in
  `.railway/railway.ts`.
- The bucket is the private R2 bucket **`squadzr-db-backups`**, with no public URL and no custom
  domain. Dumps are at `postgres/squadzr-<UTC date>T<UTC time>Z.dump`, for example
  `postgres/squadzr-2026-11-15T060003Z.dump`.
- A lifecycle rule, `delete-dumps-after-30-days`, deletes a dump 30 days after it was written. A second
  rule aborts incomplete uploads after one day. Both are in the bucket's Settings in the Cloudflare
  dashboard.
- The recovery point is up to 24 hours. There is no point-in-time recovery.
- A run that fails (dump or upload) exits non-zero, and Railway shows it as failed in the service's
  Deployments. Nothing else alerts you: look at the service after the first week, then now and then.

### Run a backup by hand

Dashboard: Railway → `squadzr` → `production` → `db-backup` → the newest deployment → **Run now**.
`TODO(#136 verify)` the button's name; the cron schedule stays in place.

Then read the log, which ends with the size and the key (never a secret):

```sh
railway logs --service db-backup --lines 20
```

### Download a dump

Dashboard: Cloudflare → R2 Object Storage → `squadzr-db-backups` → Objects → `postgres/` → the dump →
Download.

On the command line, with the `cf` CLI (a devDependency of `client/`, so it is in
`client/node_modules/.bin` after `bun install`; `cf auth whoami` shows whether it is signed in):

```sh
cf r2 object get squadzr-db-backups/postgres/<dump name> --file ./<dump name>   # TODO(#136 verify) the flags
```

`cf r2 --help` lists the exact flags if they differ.

### Restore into a throwaway database

This is how to check a backup is good. It touches nothing in production. It needs Docker, and the
dump in the current folder.

```sh
docker run -d --name pg-restore-check -e POSTGRES_PASSWORD=restore postgres:16.16-alpine3.24
docker exec pg-restore-check sh -c 'until pg_isready -U postgres; do sleep 1; done; createdb -U postgres restore_check'
docker cp ./<dump name> pg-restore-check:/tmp/restore.dump
docker exec pg-restore-check pg_restore -U postgres --no-owner --dbname restore_check /tmp/restore.dump
docker exec pg-restore-check psql -U postgres -d restore_check -c 'select count(*) from "user"' -c 'select count(*) from rooms' -c 'select count(*) from games'
docker rm -f pg-restore-check
```

`pg_restore` prints nothing and exits 0 when the restore is clean. Compare the three counts with the
same query in production (`railway connect postgres` opens a `psql` session; `TODO(#136 verify)`
that it works on this project). The Squads table is named `rooms`.
The counts match only if nothing changed since the dump, so compare against a dump taken at a quiet
moment.

### Restore into production

Only if the production database is lost or damaged. It replaces what is there with the dump, so
everything written after the dump is lost. `TODO(#136 verify)` the whole section; it has not been run
on the production database.

1. Download the dump you want (above). Decide how far back to go: the newest dump is the default.
2. **Stop the writers.** Stop `api` so nothing writes during the restore: Railway → `api` → the active
   deployment → **Remove** (keep the service). The 04:00 cron and the 06:00 backup only run at their
   times; do not restore close to them.
3. **Reach the database.** The `postgres` service has no public address. Add a temporary TCP proxy to
   it: `postgres` → Settings → Networking → TCP Proxy → port `5432`. Copy the proxy's host and port
   from the dashboard. The password is the `postgres` service's `POSTGRES_PASSWORD`; read it from the
   dashboard and never paste it in a chat or a log.
4. **Empty the database, then restore.** From a PostgreSQL 16 client (the Docker image above works:
   `docker run --rm -it -v "$PWD:/dump" postgres:16.16-alpine3.24 sh`):

   ```sh
   export DB="postgresql://postgres@<proxy host>:<proxy port>/squadzr"
   psql "$DB" -v ON_ERROR_STOP=1 -c 'DROP SCHEMA IF EXISTS drizzle CASCADE' -c 'DROP SCHEMA public CASCADE' -c 'CREATE SCHEMA public'
   pg_restore --single-transaction --exit-on-error --no-owner --dbname "$DB" /dump/<dump name>
   ```

   Each command asks for the password. Dropping both schemas first matters: a table created by a
   migration newer than the dump would otherwise survive, while the migration journal
   (`drizzle.__drizzle_migrations`) comes back without that migration, and the next pre-deploy
   would fail trying to create the table again. Dropping `public` also drops the `pg_trgm` and
   `unaccent` extensions; the dump creates them again. `--single-transaction --exit-on-error` makes the
   restore all or nothing: any error rolls it back and leaves the empty schemas, so read the error,
   fix it and run `pg_restore` again.

5. **Delete the TCP proxy.**
6. **Start `api` again:** `api` → Deployments → the last deployment → **Redeploy**, or `railway
redeploy --service api`. The pre-deploy command runs the migrations, so a dump older than the
   newest migration is brought up to date. Then check `https://api.squadzr.app/health/ready`, open
   `https://squadzr.app`, and sign in with Discord.

If the database volume itself is gone, create the `postgres` service again from `.railway/railway.ts`
(`catalog-import-railway.md`, "Apply a config change") before step 3, then restore into the empty
database.

## Rotate secrets

Never write a secret value in a commit, an issue, a log or a chat. Set values from standard input,
so they do not stay in the shell history. For example, a new random `BETTER_AUTH_SECRET`:

```sh
printf %s "$(openssl rand -base64 36)" | railway variable set BETTER_AUTH_SECRET --stdin --service api
```

Setting a variable redeploys the service. If `railway config plan` ever shows a variable to delete,
stop and read it before you apply (`catalog-import-railway.md`, "Apply a config change").

| Secret                                       | Where it lives                                                            | What happens when you rotate it                                                                                                                                                                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                         | Railway, service `api`                                                    | **Everyone is signed out.** They sign in again with Discord. The value is at least 32 characters.                                                                                                                                                                      |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Railway, service `api`                                                    | Sign-in with Discord fails until the new value is live. Create the new secret in the Discord developer portal, then update the variable.                                                                                                                               |
| `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`       | Railway, service `games-import`; `api` reads the same values by reference | The daily import and the manual import fail until the new value is live. Rotate in the Twitch developer console.                                                                                                                                                       |
| `EDGE_AUTH_TOKEN`                            | Four places (below)                                                       | Requests are refused with 403 `EDGE_AUTH_REQUIRED` while the four places disagree. Use `scripts/rotate-edge-token.mjs`.                                                                                                                                                |
| `TUNNEL_TOKEN`                               | Railway, service `cloudflared`                                            | `catalog-import-railway.md`, "The tunnel" (the paragraph "Rotate the tunnel token"). The site kept answering through the rotation.                                                                                                                                     |
| R2 keys                                      | Railway, service `db-backup` (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) | The next backup fails until the new key is live. Create it in R2 → Manage API tokens with **Object Read & Write on `squadzr-db-backups` only**. To rotate: create a new key, set both variables, run the cron by hand and check it succeeded, then delete the old key. |

### The edge token

`EDGE_AUTH_TOKEN` is one value in four places: the Cloudflare Transform Rule on `api.squadzr.app`,
the Worker secret on `squadzr-web`, the Worker secret on `squadzr-og`, and the Railway variable on
`api` (`client-on-cloudflare-workers.md`, "The edge secret"). **Nobody holds the value.** Do not
generate one by hand. Rotate it with `scripts/rotate-edge-token.mjs`. It needs the logged-in
`railway` and `cf` CLIs on the PATH and the linked Railway project (the header of the file lists
them). `cf` is a devDependency of `client/`: after `bun install`, add `client/node_modules/.bin` to
the PATH, and check the login with `cf auth whoami`. `rotate-dry` was run in production on
2026-11-13 with that `cf` (1.0.0-beta.28) and passed:

```sh
bun scripts/rotate-edge-token.mjs rotate-dry   # dry-runs the rule and both Worker secrets, changes nothing
bun scripts/rotate-edge-token.mjs rotate       # the real rotation
```

`rotate` makes the token in memory and never prints it. It stops at once, changing nothing, if
`/health/ready` does not answer. Then, in this order:

1. Sets `EDGE_AUTH_TOKEN` on Railway `api`. The old container keeps the old token until the new one
   is healthy.
2. When the new container serves, sets the secret on `squadzr-web` and `squadzr-og` and updates the
   Transform Rule, all at once.
3. Watches the site for 20 seconds and prints how many samples failed.

Expect a few seconds of 403 between steps 1 and 2. The API accepts only one token, so requests fail
from the moment the new container serves until the three Cloudflare updates finish. Rotate when few
people are online. The script was verified with `cf` 1.0.0-beta.31.

If it fails after step 1, Railway has the new token and some of Cloudflare still has the old one. If the
new container never served (the script waits 9 minutes), the slow or stuck deploy can finish at any
moment, and then every request answers 403. If a Cloudflare write failed (after three tries), it prints
`PRODUCTION INCONSISTENT` and the requests are failing already. Either way, run `rotate` again (it makes
a fresh token for all four places) or `revert`, right away. If a stuck deploy needed a redeploy, the
script runs `railway redeploy --from-source`, which deploys the latest commit of the configured branch,
which can be newer than what was running. Ctrl+C also leaves it in this state.

`revert` removes the variable from Railway and redeploys `api`. That turns the lock **off**. Use it
only in an emergency.

The manual steps, if the script cannot run, are in `client-on-cloudflare-workers.md`,
"The edge secret".

## Under attack

The API has no public address. Traffic reaches it only through the Cloudflare Tunnel, from the
Cloudflare proxy. These layers work from the outside in:

1. **Cloudflare proxy** absorbs DDoS traffic before it reaches Railway.
2. **WAF rule** blocks requests made by another zone's Worker.
3. **Rate limiting rule** (the one rule the Free plan allows): sign-in and the OAuth callback,
   5 requests per 10 seconds per IP, then 10 seconds blocked.
4. **Edge-auth header lock.** A Transform Rule writes the secret header `x-squadzr-edge-auth`. The
   API answers 403 to anything without it, except `/health` and `/health/ready`.
5. **The API's own limits**, per client address: 300 requests a minute, 20 WebSocket upgrades a
   minute and 10 open sockets (the next is closed with code 1013). The variables are in
   `catalog-import-railway.md`, "Abuse limits".

Details: `catalog-import-railway.md`, "The edge" and "Abuse limits".

### If the attack gets through

1. Look first: the Security section of the `squadzr.app` zone in Cloudflare, and `railway logs --service api --lines 200`.
2. Turn on **Under Attack mode**: Cloudflare → `squadzr.app` → Overview → Quick Actions → Under
   Attack Mode. Visitors see a "Checking your browser" page for up to five seconds. It is off by
   default ([Cloudflare docs](https://developers.cloudflare.com/fundamentals/reference/under-attack-mode/)).
   It was not tested on this app. A challenge page cannot be answered by a plain API call, so open
   the site and sign in right after you turn it on.
3. When the attack ends, turn it off.

### Raise a limit for a while, then restore it

Use this for a load test, or when real users hit the limits. The procedure (raise with
`railway variable set`, restore with `railway config apply --yes`, and the checks) is in
[`catalog-import-railway.md`, "The load script and the raised limits"](catalog-import-railway.md#the-load-script-and-the-raised-limits).
Never restore by deleting the variable: deleting does not redeploy.

### Real users behind one IP

In Brazil, many people share one public IP (carrier-grade NAT: mobile networks, some home
providers). The limits count per IP, so a whole building can look like one visitor. Watch for:

- HTTP **429** in the API logs: `railway logs --service api --lines 500 --filter "429"`.
- WebSocket close code **1013** in a player's browser. The API logs `WebSocket connection limit
exceeded` when it does that: `railway logs --service api --lines 500 --filter "connection limit"`.

If real users hit them, raise the limits as above, and pin the new values in `.railway/railway.ts`
so a later `config apply` keeps them.

## Railway hard limit

The owner set these in the Railway workspace (Usage page):

- **Hard limit:** US$ 10 a month for compute.
- **Email alert:** US$ 5.

**At the hard limit Railway takes every workload offline**, the database included. The app is down
until the next billing cycle, or until you raise the limit. Railway warns at 75% and 90% of the hard
limit, and again at 100% when it has stopped the workloads
([Railway, Cost Control](https://docs.railway.com/pricing/cost-control#hard-limit)).

To bring it back, raise the limit on the Workspace Usage page or with
`railway usage limit update --hard <dollars>` (the minimum is US$ 10, whole dollars). Railway
redeploys the stopped services by itself once the limit is raised or removed. If that fails for a
service, redeploy it by hand from the deployment's 3-dot menu
([Railway, Cost Control, FAQ](https://docs.railway.com/pricing/cost-control#usage-limits-faq)). Then
check that every service is running. Look at the current usage any time with `railway usage`.

The idle cost of this setup is about US$ 3 a month. The real number after a week of use goes into
"Actual Railway usage" below.

## Load-test numbers

Measured on 2026-11-12 against production. The table, the method and the load script are in
[`catalog-import-railway.md`, "Capacity"](catalog-import-railway.md#capacity). The short version:
about 200–250 reads a second saturate the one `api` vCPU, and memory was never the limit.

## How to scale later

Optimize first: the API CPU is the limit, and one Bun process cannot use more than one vCPU
([Capacity](catalog-import-railway.md#capacity)). Then add replicas, which need shared state. Today
it lives in the memory of the one process: the WebSocket rooms Map
(`server/src/infrastructure/websocket/ws-connection-manager.ts`), the rate-limit counters and the
Better Auth limiter. Share it with PostgreSQL `LISTEN`/`NOTIFY` first and Redis later. A future chat
feature uses the same mechanism.

## Known quirks

- **A deploy stuck at BUILDING.** Fixed with `railway redeploy --service api --from-source`.
- **CI stuck in "queued".** Re-run it, or push again.
- **A redeploy of `api` failed for no clear reason,** and the next one worked. Retry once before you
  debug.

## Actual Railway usage (one week after go-live)

TODO: the coordinator fills this in one week after go-live. Run `railway usage` and
`railway usage projects`, then write the compute cost so far, the cost per service, and whether it
trends above US$ 5 a month.
