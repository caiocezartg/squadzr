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

## Roll back

Roll back first, find the cause after. After any rollback, open `https://squadzr.app`, sign in, and
check that `https://api.squadzr.app/health/ready` answers 200.

### Roll back the API

1. Open Railway → `squadzr` → `production` → `api` → Deployments.
2. Click the three dots on the last deployment that worked, choose **Rollback**, and confirm.
   Railway restores that deployment's image **and its variables**. If you changed a variable since
   then (for example a rotated secret), check that the app still works.
3. Rollback **does not undo migrations**. The old code now runs on the new database. If the
   migration removed or renamed something the old code needs, use the second way below instead.

The second way, which is slower: revert the bad pull request on `development` (a new pull request
with `git revert`), merge it, then promote it to `main` as usual.

Source: [Railway, Deployment Actions](https://docs.railway.com/deployments/deployment-actions#rollback).
Railway keeps old deployments only for the time its plan allows. An older one has no Rollback button.

### Roll back the client

1. Open Cloudflare → Workers & Pages → `squadzr-web` → Deployments.
2. Click the three dots on the version to go back to, choose **Rollback**, and confirm.
3. The same step on the command line, with a Cloudflare API token that can edit Workers in the
   environment as `CLOUDFLARE_API_TOKEN`:

   ```sh
   bunx wrangler rollback --name squadzr-web --message "why"
   ```

   Without a version id it goes back to the version before the latest. Pass the version id to pick
   another. `bunx wrangler deployments list --name squadzr-web` shows the recent ones.

Rollback makes a new deployment of the old version at once. Cloudflare keeps the last 100 versions.
Source: [Cloudflare, Rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).

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

**Placeholder.** Backups to Cloudflare R2 are tracked in
[#136](https://github.com/caiocezartg/squadzr/issues/136), which is parked. Until it is done there
is no backup of the database. Railway volume backups need the Pro plan
(`catalog-import-railway.md`, "Backups"). The catalog can be rebuilt from IGDB. Users, Squads and
sessions cannot.

TODO when #136 is done: where the dumps are, how to restore into a throwaway database, how to
restore into production.

## Rotate secrets

Never write a secret value in a commit, an issue, a log or a chat. Set values from standard input,
so they do not stay in the shell history. For example, a new random `BETTER_AUTH_SECRET`:

```sh
openssl rand -base64 36 | railway variable set BETTER_AUTH_SECRET --stdin --service api
```

Setting a variable redeploys the service. If `railway config plan` ever shows a variable to delete,
stop and read it before you apply (`catalog-import-railway.md`, "Apply a config change").

| Secret                                       | Where it lives                                                            | What happens when you rotate it                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                         | Railway, service `api`                                                    | **Everyone is signed out.** They sign in again with Discord. The value is at least 32 characters.                                        |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Railway, service `api`                                                    | Sign-in with Discord fails until the new value is live. Create the new secret in the Discord developer portal, then update the variable. |
| `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`       | Railway, service `games-import`; `api` reads the same values by reference | The daily import and the manual import fail until the new value is live. Rotate in the Twitch developer console.                         |
| `EDGE_AUTH_TOKEN`                            | Four places (below)                                                       | Requests are refused with 403 `EDGE_AUTH_REQUIRED` while the four places disagree. Use the rotate mode.                                  |
| `TUNNEL_TOKEN`                               | Railway, service `cloudflared`                                            | `catalog-import-railway.md`, "Rotate the tunnel token". The site kept answering through the rotation.                                    |
| R2 keys                                      | Not created yet                                                           | Placeholder for [#136](https://github.com/caiocezartg/squadzr/issues/136).                                                               |

### The edge token

`EDGE_AUTH_TOKEN` is one value in four places: the Cloudflare Transform Rule on `api.squadzr.app`,
the Worker secret on `squadzr-web`, the Worker secret on `squadzr-og`, and the Railway variable on
`api` (`client-on-cloudflare-workers.md`, "The edge secret"). **Nobody holds the value.** Do not
generate one by hand. Rotate it only with the `lock-on.mjs` helper:

```sh
node lock-on.mjs rotate-dry   # rehearsal: validates the rule and the og deploy, changes nothing
node lock-on.mjs rotate       # the real rotation
```

What `rotate` does, in this order:

1. Makes a random token in memory and writes it only to private temporary files and to the standard
   input of child commands. It never prints it, and it deletes the files at the end.
2. If the `squadzr-og` Worker does not exist yet, deploys it with the new secret.
3. Sets `EDGE_AUTH_TOKEN` on Railway `api`. This starts a deploy. The old container keeps the old
   token until the new one is healthy.
4. When the new container serves, sets the secret on `squadzr-web` (and `squadzr-og`) and updates the
   Transform Rule, all at once.
5. Watches the site for 20 seconds and prints how many requests failed, if any.

`lock-on.mjs revert` removes the variable from Railway. That turns the lock **off**. Use it only in
an emergency.

> **TODO (not done in this pull request).** `lock-on.mjs` is not in the repository. Today it sits in
> a scratch folder of the session that wrote it (issue #135), with the paths of that machine written
> in the file. Before the owner relies on this section, commit the script (for example under
> `scripts/`) with its paths made relative, or write the manual steps. Until then, the manual way is
> in `client-on-cloudflare-workers.md`, "The edge secret".

## Under attack

The API has no public address. Traffic reaches it only through the Cloudflare Tunnel, from the
Cloudflare proxy. These layers work from the outside in:

1. **Cloudflare proxy** absorbs DDoS traffic before it reaches Railway.
2. **WAF rule** blocks requests made by another zone's Worker.
3. **Rate limiting rule** (the one rule the Free plan allows): sign-in and the OAuth callback,
   5 requests per 10 seconds per IP, then 10 seconds blocked.
4. **Edge-auth header lock.** A Transform Rule writes the secret header `x-squadzr-edge-auth`. The
   API answers 403 to anything without it, except `/health` and `/health/ready`.
5. **The API's own limits**, per client address (an IPv6 address counts as its /64):

   | Variable                    | Value | Meaning                                                            |
   | --------------------------- | ----- | ------------------------------------------------------------------ |
   | `RATE_LIMIT_MAX`            | 300   | requests per minute per IP, on every route                         |
   | `WS_UPGRADES_PER_MINUTE`    | 20    | WebSocket connection attempts per minute per IP                    |
   | `WS_MAX_CONNECTIONS_PER_IP` | 10    | open sockets at once per IP. The next one is closed with code 1013 |

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

Use this for a load test, or when real users hit the limits.

1. Raise the variables you need. This redeploys `api`:

   ```sh
   railway variable set RATE_LIMIT_MAX=1000 --service api
   ```

   Wait until the deployment is `SUCCESS` (`railway deployment list --service api`). Any response
   carries the new number in `x-ratelimit-limit`.

2. Put the limits back, from a checkout of `main`, with the Railway CLI 5.42.1 or newer:

   ```sh
   railway config apply --yes
   ```

   This restores the pinned values (300, 20, 10) and redeploys `api`.

3. Check: the deployment is `SUCCESS`, `/health/ready` answers 200, a response carries
   `x-ratelimit-limit: 300`, and `railway config plan --detailed-exit-code` exits 0.

**Never restore by deleting the variable.** Deleting does not redeploy, so the container keeps the
raised limit.

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

To bring it back, raise the limit on the Workspace Usage page (or with `railway usage limit`), then
check that every service is running. Look at the current usage any time with `railway usage`.

The idle cost of this setup is about US$ 3 a month. The real number after a week of use goes into
"Actual Railway usage" below.

## Load-test numbers

Measured on 2026-11-12 against production. The full table and the method are in
[`catalog-import-railway.md`, "Capacity"](catalog-import-railway.md#capacity). The short version:

- **About 200–250 reads a second saturate the one `api` vCPU.** CPU gave out first, then Postgres.
- **800 sockets were fine.** 800 players reading at 20 requests a second held. 400 players at
  100 requests a second held.
- **Memory was never the limit.** The peak was 0.37 GB of the 512 MiB limit.
- Past about 250 requests a second, Railway also drops log lines.

The load script is not in the tree. It is in git history at commit `47997ba`:
`git checkout 47997ba -- server/src/interface/scripts/load-test server/src/interface/scripts/load-test.ts`.
Raise the per-IP limits before you run it, and restore them after ("Raise a limit for a while").

## How to scale later

Do these in this order.

1. **Optimize first.** The API CPU is the limit, so make the busiest reads cheaper before you pay
   for more.
2. **Then try a bigger CPU limit** on `api` (`limitOverride` in `.railway/railway.ts`). The load
   test notes that the API is one Bun process that cannot use more than one vCPU, so this helps only
   up to about one core. After that, add replicas.
3. **Replicas need shared state.** Today these live in the memory of the one process, so two
   replicas would each see a different half:
   - the WebSocket rooms Map in `server/src/infrastructure/websocket/ws-connection-manager.ts`;
   - the per-IP request counters (`@fastify/rate-limit`) and the open-socket counter;
   - the Better Auth rate limiter.
4. **Share state with PostgreSQL first:** `LISTEN`/`NOTIFY` for the realtime events. Use Redis only
   if that is not enough. A future chat feature uses the same mechanism.

## Known quirks

- **A deploy stuck at BUILDING.** Fixed with `railway redeploy --service api --from-source`.
- **CI stuck in "queued".** During a GitHub webhooks incident, a CI run on commit `f260f33` stayed
  queued. Re-running it, or pushing again, fixed it.
- **A redeploy of `api` failed for no clear reason,** and the next one worked. Retry once before you
  debug.

## Actual Railway usage (one week after go-live)

TODO: the coordinator fills this in one week after go-live. Run `railway usage` and
`railway usage projects`, then write the compute cost so far, the cost per service, and whether it
trends above US$ 5 a month.
