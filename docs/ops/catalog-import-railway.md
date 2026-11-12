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
| API service    | `api`, deployed from `caiocezartg/squadzr` branch `main`, at `https://api.squadzr.app` through the tunnel (no Railway domain)            |
| Tunnel service | `cloudflared`, the official image pinned to an exact version, 2 replicas (see "The tunnel")                                              |
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
(a proxied CNAME to a Cloudflare Tunnel, see "The edge" and "The tunnel" below) and has no Railway domain, public
or custom: nothing answers for it on Railway's edge. `/health/ready` is its health check, which Railway probes
over its own internal path, and a deployment that does not answer it never takes traffic.

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
  `TRUST_PROXY_HOPS=1` (`cloudflared`, see "The edge"), `HOST=::` and `PORT=3000` (where the tunnel reaches it, see "The
  tunnel") and `DATABASE_URL` (a reference to `postgres`) are in the authoring file, and the
  IGDB credentials are references to the `games-import` ones. `BETTER_AUTH_SECRET`, `DISCORD_CLIENT_ID`,
  `DISCORD_CLIENT_SECRET` and `EDGE_AUTH_TOKEN` are `preserve()`d: they exist only in Railway, never in the
  repository.
  The Discord application needs `https://api.squadzr.app/api/auth/callback/discord` as a redirect URI.

### The edge

`api.squadzr.app` is proxied by Cloudflare (zone `squadzr.app`, Free plan) and reaches the API through a Cloudflare
Tunnel (see "The tunnel"). The rules below match on the host name, so they apply to tunnel traffic exactly as they
did to the public domain (checked on the tunnel: the Transform Rule stamps the header, the rate limiting rule
answers 429 to the sign-in burst, and a `workers.dev` Worker, which is not in the zone, gets Cloudflare's 403 page). Four things live in
the Cloudflare zone, outside this repository:

- **Transform Rule** (`http_request_late_transform`): on host `api.squadzr.app` it **sets** (overwrites)
  the request header `x-squadzr-edge-auth` to the edge secret, so a client cannot choose it, and the header
  `x-squadzr-worker-zone` to `cf.worker.upstream_zone`, the zone of the Worker that made the request (empty,
  so the header is removed, for a request no Worker made; the app's own Workers were observed with it empty
  in November 2026, and `squadzr.app` would mean the same, so the WAF rule below allows both and no other zone).
- **Rate limiting rule** (`http_ratelimit`, the one the Free plan allows): `/api/auth/sign-in/*` and
  `/api/auth/callback/*` on that host, 5 requests per 10 seconds per IP (the Free plan counts per IP and per
  Cloudflare data center), then blocked for 10 seconds with a 429. Every other route is limited by the API
  itself (see "Abuse limits").
- **WAF custom rule**: blocks a request to that host that another zone's Worker made
  (`http.host eq "api.squadzr.app" and not cf.worker.upstream_zone in {"" "squadzr.app"}`). Only the browser
  and this app's own Worker reach the API.
- **DNS**: the `api` CNAME is proxied and points at `<tunnel id>.cfargotunnel.com`. The `_railway-verify.api` TXT
  from the days of the Railway custom domain stays DNS-only and unused; it is harmless.

The API reads the secret from the optional `EDGE_AUTH_TOKEN` variable, a `preserve()`d variable of the
authoring file. Set, a request without the matching `x-squadzr-edge-auth` header gets 403
(`EDGE_AUTH_REQUIRED`), CORS preflights and WebSocket handshakes included; exactly `/health` and
`/health/ready` are exempt, because Railway probes them directly. Unset, the API behaves as if the lock did
not exist. Production sets it. The Transform Rule's value, the client Worker's secret and `EDGE_AUTH_TOKEN`
are one value and change together (`docs/ops/client-on-cloudflare-workers.md`, "The edge secret").

At `LOG_LEVEL=debug` each request logs `Edge request headers` with `edgeAuthHeader` (`present` or `absent`,
never the value) and `cfConnectingIp`.

**Client address.** Behind the tunnel the peer is `cloudflared` on Railway's private network, and it forwards the
`x-forwarded-for` Cloudflare's edge wrote, so at `TRUST_PROXY_HOPS=1` the proxy chain names the visitor for a browser
request (measured on the hosted API: the info line's `remoteAddress`, which is `request.ip` before the edge guard
runs, was the tester's own address, with and without the secret). A Worker's subrequest names the Worker there.
The address that holds for both is `CF-Connecting-IP`, which anyone who reaches the origin some other way can write.
So the API believes it only on a request whose edge secret matched (`EDGE_AUTH_TOKEN` set and the header right): it
then becomes the single `x-forwarded-for` entry, and `request.ip` (the app rate limits, the Discord invite
check), the Better Auth rate limiter and the log's `clientIp` field all read it. Better Auth is fed from
`request.ip` and keys its limiter on the one header the server writes (its documented setup for an address
the server code sets), so it needs no option of its own. With the lock off, or with a missing or invalid
`CF-Connecting-IP` (a warning, never the token), the proxy chain's address is used. `TRUST_PROXY_HOPS` stays
at 1: `cloudflared` is the only proxy whose header is believed, and a larger count would trust nothing more.
Setting it to 0 trusts no header at all, this one included. The info-level "incoming request" line is written
before any hook runs, so its `remoteAddress` is the proxy chain's address; the address the API counts by is the
`clientIp` of the same request's "request completed" line. While the lock is off, requests are attributed to
the proxy chain's address.

### The tunnel

`api.squadzr.app` reaches the API through a remotely managed Cloudflare Tunnel (`squadzr-api`, id `fa41f989-e6f5-486f-977c-1d2b78da8877`, Zero Trust, free on
every plan; it needs no Access policy or paid feature). The pieces:

- **`cloudflared` service** (`.railway/railway.ts`): the official `cloudflare/cloudflared` image pinned to an exact
  release, started with `cloudflared tunnel --no-autoupdate --metrics 0.0.0.0:2000 run`, two replicas in
  `us-east4-eqdc4a`, capped at 0.25 vCPU and 128 MiB each (`limitOverride`). The agent reads its token from the
  `preserve()`d variable `TUNNEL_TOKEN`; the health check is `/ready` on the metrics port (`PORT=2000`), which
  answers 200 only while the agent holds a connection to Cloudflare. Each replica opens 4 connections, so a healthy
  tunnel shows 8.
- **Tunnel and route** (Cloudflare, outside the repository): the ingress rules are `api.squadzr.app` →
  `http://api.railway.internal:3000` and a catch-all `http_status:404`. The API listens on `HOST=::`, `PORT=3000`:
  Railway's private network can be IPv6-only, and `::` is dual-stack, so the health check, which arrives over IPv4
  (`::ffff:100.64.0.1`), still gets through.
- **DNS**: `api.squadzr.app` is a proxied CNAME to `<tunnel id>.cfargotunnel.com`.
- **No Railway domain**: `api` has neither a service domain nor a custom domain. The IaC engine does not remove a
  domain it no longer declares, so deleting one is `railway domain delete <domain> --service api --yes`; list
  what is left with `railway domain list --service api`. A request to Railway's edge with `Host: api.squadzr.app`
  answers 404 `Application not found`.

Health and checks:

```sh
# Tunnel status and connections: 2 clients with 4 connections each. $CF_API_TOKEN is an API token with
# Cloudflare Tunnel Read, $CF_ACCOUNT_ID the account id, and $TUNNEL_ID the tunnel id given above.
curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/connections"
# The same tunnel's status (healthy, degraded or down)
curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID"
railway logs --service cloudflared --lines 50   # "Registered tunnel connection" x4 per replica
```

Stopping one replica does not take the site down: with the replicas scaled to one (`regions` count 1, applied),
the probe of `/health/ready` every second had no failure, and a Squad could be created and joined over the
WebSocket. Scale it back with the authoring file (`regions: { 'us-east4-eqdc4a': 2 }`) and `config apply`.
Usage measured on the hosted tunnel with light traffic: about 0.004 vCPU and 41 MiB for the service (peaks
0.01 vCPU and 48 MiB), which is under US$ 1 a month of Railway usage for the two replicas.

**Cutover from the public domain** (done once; the order that kept the API up): create the tunnel, deploy the
`cloudflared` service and wait for 8 connections while the old path still serves; change the `api` DNS record to the
tunnel's CNAME; check `/health/ready` and a real route; only then delete the Railway domain. Cloudflare's edge takes
up to about two minutes to follow a changed record, and both origins answer during that time, so no probe failed
(each switch below was watched with a request every second).

**Rotate the tunnel token.** Zero Trust ➜ Networks ➜ Tunnels ➜ `squadzr-api` ➜ refresh token, or the API:
`PATCH /accounts/<account id>/cfd_tunnel/<tunnel id>` with a new `tunnel_secret` (32 random bytes, base64), then
`GET .../cfd_tunnel/<tunnel id>/token`. The old token stops working for new connections at once. Put the new one
in Railway without echoing it or putting it on a command line:

```sh
printf %s "$NEW_TOKEN" | railway variable set TUNNEL_TOKEN --stdin --service cloudflared
```

Setting the variable redeploys the two replicas (a rolling replacement); the site kept answering through it
(no failed probe), and the tunnel was back to 2 clients and 8 connections. The value never goes in a commit, an
issue, a log or a chat. The token is not the edge secret: rotate `EDGE_AUTH_TOKEN` separately
(`docs/ops/client-on-cloudflare-workers.md`, "The edge secret").

**Upgrade `cloudflared`.** Change the version tag in `.railway/railway.ts` (never `latest`) and `config apply`.

**Roll back to a public Railway domain.** Two situations, both ending with `api.squadzr.app` served by Railway
instead of the tunnel. The header lock, the WAF rule and the rate limiting rule do not depend on the path, so they
keep working; `TRUST_PROXY_HOPS` is 1 either way.

1. _While the Railway domain still exists_ (tested): change the `api` CNAME to the domain's target (`2adifz58.up.railway.app`
   at the time), proxied. Cloudflare followed in about two minutes, then served from Railway's edge (the API logs
   showed Railway's addresses as the peer); no probe failed. To go back to the tunnel, change the CNAME to
   `<tunnel id>.cfargotunnel.com`; it took about 30 seconds and no probe failed.
2. _After the Railway domain was removed_ (the state of production): see "Re-add the public domain" below.

**Re-add the public domain** (the state of production, where `api` has no Railway domain). Tested on a throwaway host
name, `rollback-test.squadzr.app`, with the same steps as for `api.squadzr.app`; the authoring file does not manage
Railway domains (a `networking.customDomains` entry was ignored by `config plan` and `config apply` in the test), so
this is done with the CLI:

```sh
railway domain api.squadzr.app --service api   # prints the CNAME target and the _railway-verify TXT to create
railway domain list --service api              # the domain and its sync status
railway domain status <domain id> --service api
```

In Cloudflare, point the `api` record at the printed target (CNAME, proxied) and make sure the
`_railway-verify.api` TXT holds the printed value (DNS only). In the test the domain was `ACTIVE` with a valid
certificate 16 seconds after it was created (9 seconds after the records), and `/health/ready` answered 200
through Cloudflare. Then check `/health/ready` and a real route on `api.squadzr.app`. Nothing else changes: the
Transform Rule, the lock (`EDGE_AUTH_TOKEN`), the WAF and rate limiting rules and `TRUST_PROXY_HOPS=1` work the
same on this path, and `HOST=::` keeps working. Railway's edge then replaces `x-forwarded-for` with the address
that connected to it, so the visitor's address comes from `CF-Connecting-IP` behind the lock only, as before
the tunnel. Once the public domain is back, the `cloudflared` service can stay (the tunnel is simply unused) or
be removed from the authoring file. Delete the throwaway test records and domain afterwards:
`railway domain delete <domain> --service api --yes` and the two DNS records.

### Abuse limits

The API counts requests by client address, which behind the lock is the visitor's (`request.ip`; IPv6
addresses by their /64). The limits are environment variables with these defaults, validated at start, and
0 turns one off:

- `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS`: 300 requests per 60 seconds on every route, at `onRequest`
  after the edge guard. `/health` and `/health/ready` are not counted. The Discord invite check is counted
  like every route, anonymous requests included, and has a second quota of 30 checks a minute per signed-in
  user (`preHandler`, after authentication, built with `createRateLimit` so it counts apart from the first).
- `WS_UPGRADES_PER_MINUTE`: 20 upgrades of `/ws` per address per minute (429 before the upgrade). The route's
  own limit replaces the 300 a minute, so the upgrade is counted by this one alone.
- `WS_MAX_CONNECTIONS_PER_IP`: 10 sockets per address at once; the next one is accepted and closed at once
  with code 1013 ("try again later").

Because the address is only the visitor's behind the lock, the limits mean what they say once
`EDGE_AUTH_TOKEN` is set. With the lock off, a browser request still counts by the visitor (the proxy chain
names them behind the tunnel) but every server render counts under the Worker's address, one bucket anyone could
exhaust: keep the lock on. The counter is the API's own, keyed on that address, so which `cloudflared` replica
carried a request does not matter (measured: one visitor's burst from a single address was limited at 300 a
minute while both replicas carried it).

**Server renders.** The Next server's own calls reach the API from the Worker, whose address is not the
visitor's. A call that speaks for a viewer (the session, the board, a Squad) carries the visitor's address in
`x-real-ip`; Cloudflare reports that on a Worker subrequest to this zone as `CF-Connecting-IP`, and removes
`x-real-ip` from every request no Worker made, so a visitor is counted for their own page loads and a flood
of page views spends their quota, not everyone's. So does every other call that is not revalidated, an
anonymous one included (the invite preview read, which crawlers trigger). Only a call whose response Next
shares between visitors (the landing's popular games, revalidated) carries no address, because a per-visitor
header would split that cache; it is counted under the Worker's address, at most one call per isolate every
five minutes. Nothing is exempted for being a Worker call: the amplification (a page view
becomes several API calls) is what the limit is for. The `workerZone` field of the request log (written only
on a request whose edge secret matched) was observed empty for the app's own renders in November 2026, although
Cloudflare documents `cf.worker.upstream_zone` as the calling Worker's zone. Empty and `squadzr.app` both mean the
app's own renders; the WAF rule blocks any other zone before the request gets here.

## Capacity

Measured on 2026-11-12 against production (one `api` replica of 1 vCPU and 512 MiB, `postgres` of 1 vCPU and 512 MiB, `cloudflared` x2), from a single machine in Brazil, so every latency includes about 140 ms of round trip. Each step connected N players with a session and a WebSocket each, made and joined their Squads, then read the Squad Board with the players' cookies for 45 to 60 seconds.

| N players | Board reads/s | Sockets connected | p50 / p95       | Errors                   | `api` CPU / RAM (peak) | `postgres` CPU / RAM (peak) |
| --------- | ------------- | ----------------- | --------------- | ------------------------ | ---------------------- | --------------------------- |
| 10        | 18            | 10 / 10           | 139 / 151 ms    | 0 %                      | 0.18 vCPU / 0.17 GB    | 0.01 vCPU / 0.09 GB         |
| 25        | 50            | 25 / 25           | 141 / 156 ms    | 0 %                      | 0.23 vCPU / 0.20 GB    | 0.10 vCPU / 0.12 GB         |
| 50        | 100           | 50 / 50           | 157 / 180 ms    | 0 %                      | 0.69 vCPU / 0.23 GB    | 0.51 vCPU / 0.12 GB         |
| 100       | 200           | 100 / 100         | 164 / 207 ms    | 0 %                      | 0.68 vCPU / 0.28 GB    | 0.40 vCPU / 0.12 GB         |
| 400       | 100           | 400 / 400         | 176 / 237 ms    | 0 %                      | 0.79 vCPU / 0.33 GB    | 0.80 vCPU / 0.13 GB         |
| 800       | 20            | 800 / 800         | 175 / 235 ms    | 0 %                      | 0.49 vCPU / 0.37 GB    | 0.13 vCPU / 0.11 GB         |
| 200       | 250           | 200 / 200         | 8.0 s / 11.4 s  | 0.01 %                   | 1.02 vCPU / 0.24 GB    | 0.24 vCPU / 0.12 GB         |
| 100       | 400           | 100 / 100         | 14.5 s / 15.0 s | 43 % (timeouts)          | 1.02 vCPU / 0.29 GB    | 0.86 vCPU / 0.13 GB         |
| 800       | 100           | 800, then 73      | 7.9 s / 12.1 s  | 4 % (502, 520, timeouts) | 1.10 vCPU / 0.37 GB    | 0.54 vCPU / 0.13 GB         |

What it means:

- **The `api` CPU gave out first.** The Fastify server is one Bun process, so it cannot use more than one vCPU; authenticated Squad Board reads saturate it between 200 and 250 requests a second, whatever the number of players (200 a second was still at p95 207 ms). `postgres` reached 0.86 vCPU at 400 requests a second, after the API. Memory was never the limit: the peak was 0.37 GB of 0.54 GB, with 800 sockets.
- **Sockets are cheap, requests are not.** 800 connected players reading the board at 20 requests a second held, and 400 players at 100 requests a second held. The same 800 at 100 requests a second saturated the CPU and the sockets dropped (73 left).
- **Past about 250 requests a second Railway also drops log lines** (its limit is 500 lines a second per replica, and each request writes two).
- **Cloudflare never challenged or blocked the test address** (no `cf-mitigated` response). The 502 and 520 answers came only from the overloaded step.
- The limits (1 vCPU and 512 MiB for `api` and `postgres`) stay as they are. More CPU does not help a single Bun process, and both are ceilings, not reservations: Railway bills what is used. More capacity means a second `api` replica, which also doubles the base memory cost.
- The per-address abuse limits of "Abuse limits" were raised for the test and put back: the 301st request in a minute answers `429` with `Retry-After: 60`, the 11th concurrent socket is accepted and closed with code `1013` ("Too many connections"), and the 21st upgrade in a minute answers `429`.

### Running the load test

The script makes throwaway players straight in the database (no Discord, no sign-in route), so its database side runs inside the `api` service, where `DATABASE_URL` and `BETTER_AUTH_SECRET` already exist; neither leaves the service. It needs an SSH key registered with Railway (`railway ssh keys add`, remove it afterwards) and the repository linked (`railway link`):

```sh
cd server
export LOAD_TEST_DATA_COMMAND="bash $(pwd)/src/interface/scripts/load-test/railway-data.sh"
# Only if the Railway CLI is not `railway` on the PATH: export RAILWAY_BIN=/path/to/railway

# N players, a board read rate, a duration; the tag marks every row the run creates
bun src/interface/scripts/load-test.ts run --target https://api.squadzr.app --players 50 --rps 100 --duration-seconds 60
```

- All players come from one address, so the per-address limits of "Abuse limits" block any run bigger than 10 players. Raise `RATE_LIMIT_MAX`, `WS_UPGRADES_PER_MINUTE` and `WS_MAX_CONNECTIONS_PER_IP` on `api` for the test window only (for example 100000, 5000 and 2000), and restore them right after. **Deleting a variable does not redeploy**: run `railway redeploy --service api --yes` afterwards and check `x-ratelimit-limit: 300` on any response.
- The run prints connected sockets, p50/p95/p99 and the error rate of the board reads, then deletes its players, Squads and Squad Records and prints the remaining counts, which must all be 0. It stops early when more than half of the board reads fail. On Ctrl+C or a failure it still cleans up; if the connection to Railway fails, rerun `railway-data.sh cleanup --tag <tag>` and `verify --tag <tag>` (`cleanup` and `verify` without a tag cover every run).
- Every row carries the tag: the players' emails are `lt-<tag>-<n>@loadtest.squadzr.test`, their names `LT <tag> <n>` and the Squads are named `<tag>-<n>`. `audit_entries` is append-only and the run never writes to it; the Activity Sampler (not the test) adds its usual rows.
- The Squads need a real Discord invite, because the API asks Discord before it accepts one: `--discord-invite` defaults to `https://discord.gg/discord-api`.
- Memory and CPU come from the Railway metrics. A step's window can take a minute or two to appear; query it afterwards with `railway api 'query { metrics(environmentId: "<id>", serviceId: "<id>", startDate: "<ISO>", endDate: "<ISO>", measurements: [CPU_USAGE, MEMORY_USAGE_GB], sampleRateSeconds: 30) { measurement values { ts value } } }'`.

To check the abuse limits themselves, run `limits` from a place that always presents one address, such as the `api` service itself: a home connection can show different addresses to the API (IPv4 and IPv6, or a shared pool), which spreads the count and hides the limit. Bundle the script and send it over SSH:

```sh
cd server
bun build src/interface/scripts/load-test.ts --target bun --external zod --outfile /tmp/load-test.js
railway ssh --service api -- 'f=server/.load-test.js; trap "rm -f $f" EXIT; cat > $f && cd server && bun --no-env-file .load-test.js limits --target https://api.squadzr.app' < /tmp/load-test.js
```

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
