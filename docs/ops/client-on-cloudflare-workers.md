# The client on Cloudflare Workers

The Next.js client runs as the Worker `squadzr-web` at `https://squadzr.app`, built with
[vinext](https://github.com/cloudflare/vinext). The API runs on Railway at `https://api.squadzr.app`
(`docs/ops/catalog-import-railway.md`). The decision and its consequences are in
[ADR 0006](../adr/0006-host-on-cloudflare-workers-and-railway.md). A second, small Worker, `squadzr-og`,
renders the link preview image of Squad invites on `squadzr.app/og/*` (see "The Squad invite image").

## What is in the repository

|                     |                                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Worker config       | `client/cloudflare.config.ts`: the name, the `squadzr.app` custom domain, `nodejs_compat`, the static assets and the `EDGE_AUTH_TOKEN` secret |
| Build config        | `client/vite.config.ts`: the vinext and Cloudflare Vite plugins, with no cache adapter and no image optimizer                                 |
| Deploy workflow     | `.github/workflows/deploy-client.yml`                                                                                                         |
| Scripts             | `bun run build:vinext`, `bun run start:vinext` (local preview in workerd), `bun run deploy:vinext` (build and deploy), all in `client/`       |
| Generated (ignored) | `client/.vinext/` and `client/.cloudflare/`                                                                                                   |

`next dev`, `next build` and the CI `build` gate do not use the Cloudflare files.

## Deploys

GitHub runs a `workflow_run` workflow as it is on the default branch (`main`), so the first deploy happens
only after the promotion pull request that brings `deploy-client.yml` into `main`; until then merging to
`development` deploys nothing.

A push to `main` runs the CI workflow; when it succeeds, `Deploy client` builds the commit CI tested
with `NEXT_PUBLIC_API_URL=https://api.squadzr.app` and deploys it to the Worker, then deploys
`squadzr-og` from `og/` (`bun run deploy`). A failing CI run, a push
to `development` and a pull request deploy nothing. `main` only receives promotion pull requests, so a
deploy is a merged promotion.

The workflow needs two repository secrets (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_ACCOUNT_ID`: the account id.
- `CLOUDFLARE_API_TOKEN`: an API token that can edit Workers scripts on the account and the Workers
  routes and DNS of the `squadzr.app` zone (the custom domain creates its DNS record).

To deploy by hand (the same build the workflow makes), sign in once with `cf auth create <profile>`
(a browser approval) and run, in `client/`:

```
NEXT_PUBLIC_API_URL=https://api.squadzr.app bun run deploy:vinext
```

To look at the build before deploying, `bun run build:vinext` then `bun run start:vinext` serves it in
workerd on `localhost` (the API URL is read at build time). Local Worker secrets go in `client/.dev.vars`,
which git ignores.

## The first deploy of a Worker

`bindings.secret()` makes `cf deploy` refuse a Worker that does not exist yet and has no `EDGE_AUTH_TOKEN`
("required secrets have not been set"), so the workflow cannot create it. Create it once by hand from
`client/`, signed in with `cf auth create <profile>`, with the secret in a file outside the repository
(`EDGE_AUTH_TOKEN=<value>`, deleted straight after):

```
NEXT_PUBLIC_API_URL=https://api.squadzr.app bun run build:vinext
cf deploy --prebuilt --secrets-file <path to the file>
```

Every later deploy, including the workflow's, finds the secret already set and needs nothing else.

`squadzr-og` declares the same secret, so its first deploy is the same bootstrap, from `og/`:

```
bun run build
cf deploy --prebuilt --mode production --secrets-file <path to the file>
```

`--mode production` names the mode `vite build` records in the Build Output: `cf deploy --prebuilt` must be
given the mode the output records ("Deploy a prebuilt build" in the `cf` docs). The image Worker's
throwaway deploys on 2026-11-11 used exactly this command.

Until `squadzr-og` exists with its secret, the workflow's second step fails after `squadzr-web` has
deployed: the site is live, and invite links point at images that answer 404 until the image Worker is up.
Create `squadzr-og` before the first promotion that carries `og/`.

## The Squad invite image (`squadzr-og`)

A Squad invite's preview shows an image made for its game, its slots and its language (GitHub #152). The
Squad page's metadata (`client/src/features/lobby/lobby-metadata.ts`) points at
`/og/squad/<design version>/<game id>/<filled>-<total>/<language>.jpg`; the key, its validation and the
design version (`SQUAD_PREVIEW_DESIGN_VERSION`) live in `packages/schemas/src/squad-preview.ts`. Every
Squad in the same state shares one image, and a Squad that gains a member points at the next key, so each
image is rendered once and served as `Cache-Control: public, max-age=31536000, immutable`.

|               |                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Worker config | `og/cloudflare.config.ts`: the name, the `squadzr.app/og/*` route, the Worker cache, the secret  |
| Code          | `og/src/`: the request handler, the layout (satori), the rasterizer (resvg) and the JPEG encoder |
| Scripts       | `bun run build`, `bun run deploy` and `bun run dev`, in `og/`                                    |

- It is a separate Worker so the renderer (about 0.85 MB gzip of WASM and JavaScript) stays out of
  `squadzr-web`, and so the **Worker cache**, which bills every request it sees, is on for this Worker
  only: `squadzr-web`'s static assets stay free. A repeat request for a key is a cache HIT and runs no code.
- The cache outlives deploys (`crossVersionCache`), so a deploy that changes nothing in the picture
  renders nothing again, and the workflow deploys the Worker on every promotion. **A change to how the
  image looks bumps `SQUAD_PREVIEW_DESIGN_VERSION`**: every Squad then points at new keys, and the old
  entries are never asked for again. A change that keeps the picture (a fix in the handler, say) keeps
  the version.
- It answers 404 (cached five minutes) to anything that is not the exact spelling of a key in the current
  design (counts from 1 of 2 up to 40 of 40, `en` or `pt-br`), to any query string, to an unknown game and
  to a game whose cover is not on IGDB. A failed or slow (over five seconds) game or cover read answers an
  uncached 502. The slot counts are not checked against the game's player limit: a Squad can have more
  slots than its game allows today.
- It reads the game's name and cover from `GET /api/games/:id` with the edge secret, never a session, and
  draws no member, Squad name or avatar. It must send the secret itself: the Transform Rule does not stamp
  a subrequest made by a Worker of the zone (tested on 2026-11-11 with a throwaway route on `squadzr.app`,
  which got 403 `EDGE_AUTH_REQUIRED` without it).
- It fetches covers only from `https://images.igdb.com/igdb/image/upload/`, follows no redirect, and
  accepts only a JPEG or PNG of at most 1 MB.
- **Accepted risk: random game ids reach the API.** Anyone can request keys with made-up UUIDs; each one
  costs a Worker request and an API read that answers 404, and the 404 is cached for five minutes per URL.
  Nothing is rendered for them. The cost is bounded by request billing and the API's own per-visitor
  limits, so there is no allowlist of game ids in the Worker.
- The image is a JPEG (90–120 KB): as a PNG, the cover photo and its blurred copy weigh 350–550 KB,
  above the roughly 300 KB WhatsApp shows.
- The layout uses the full width of the wide card (box art on the left, text on the right, 84px
  margins). A square crop of the centre keeps the kicker, the status line and the slots, and part of the
  game's name.
- The slots follow the Squad card's rail (`avatarRail` in `@squadzr/schemas`, the one rule both draw
  from): at most five circles, filled first, then `+N` in the site's mono face for the slots past five,
  next to the full `filled/total` count.
- One render costs about 1.0 s of CPU (median; p95 about 2.1 s), measured on Workers on 2026-11-11. Most of it is
  the rasterizer, so the layout avoids what it is slow at: no blur filter (the backdrop is IGDB's 35px
  micro cover stretched, which reads as a blur), no blurred shadow, the rail's circles in one SVG, and the 264px
  cover for the box art.
- The fonts are the site's (Big Shoulders 900, Plus Jakarta Sans 600 and 800) as WOFF in `og/src/fonts/`,
  because satori cannot read WOFF2. The logo is `client/public/squadzr-logo.svg`, which `og/turbo.json`
  lists as an input of the build.

To look at an image locally, put a placeholder `EDGE_AUTH_TOKEN` (32 visible characters) in `og/.dev.vars`
(git ignores it), run `bun run build` then `bunx vite preview --port 3002` in `og/`, and open
`http://localhost:3002/og/squad/v1/<game id>/3-5/pt-br.jpg`. The API lets the call in without the real
secret because the edge stamps it on requests from outside the zone.

## The `revalidate` cache without KV

The Worker has no KV namespace. Next's `revalidate` cache therefore lives in each isolate's memory: the
only call that uses it, the landing's popular games (`/api/games/popular`, five minutes), is read once per
isolate per five minutes instead of once per five minutes overall. A cold isolate, and each new isolate
after a deploy, calls the API once. Calls that read a viewer's data are never cached.

Images are not optimized: `next/image` renders Discord avatars as a plain `<img>` of the original
`cdn.discordapp.com` URL, and no request reaches `/_next/image`.

## The edge secret

The secret is one value in four places, and the four change together:

1. the **Transform Rule** on `api.squadzr.app` (Cloudflare, `http_request_late_transform`), which writes it
   in the `x-squadzr-edge-auth` request header on everything sent to the API;
2. the **Worker secret** `EDGE_AUTH_TOKEN` on `squadzr-web`, which the Next server sends in the same header
   on its own calls (`client/src/lib/server/api.ts`; it reads `process.env`, which the `nodejs_compat`
   flag fills from the Worker's bindings);
3. the **Worker secret** `EDGE_AUTH_TOKEN` on `squadzr-og`, which the image Worker sends on its game reads
   (`og/src/game-source.ts`);
4. the Railway variable `EDGE_AUTH_TOKEN` on `api` (a `preserve()`d variable in `.railway/railway.ts`),
   which turns the origin lock on.

The value is at least 32 visible ASCII characters (both sides validate it with Zod). To rotate it, generate
a new random value without echoing it and update the four places back to back. Until the last one is
done, some requests carry the old value and are refused with 403 `EDGE_AUTH_REQUIRED`, so do it when
nobody is online and open `https://squadzr.app` afterwards. The value never goes in a commit, an issue, a
log or a chat. Never pass the value on a command line (`--text <value>` lands in the shell history and the
process list). Write it to a file outside the repository that only you can read, as the JSON
`{"EDGE_AUTH_TOKEN": {"type": "secret_text", "text": "<value>"}}`, set the secret from the file and delete
the file at once:

```
cf workers secrets bulk --worker squadzr-web --secrets @<path to the file>
cf workers secrets bulk --worker squadzr-og --secrets @<path to the file>
```

## Rules in the Cloudflare zone

These live in the `squadzr.app` zone (Free plan), outside this repository:

- **DNS.** `squadzr.app` is attached to the Worker as a custom domain (the deploy creates its record).
  `www` has a proxied placeholder record so the redirect below can match.
- **Worker route** `squadzr.app/og/*` → `squadzr-og` (the deploy creates it from `og/cloudflare.config.ts`).
  A route wins over the custom domain for its paths, so `squadzr-web` serves everything else.
- **Redirect rule.** `www.squadzr.app/*` → `https://squadzr.app/${path}` (301, query string kept).
- **Transform Rule** on `api.squadzr.app`: see "The edge secret". It also sets `x-squadzr-worker-zone` to
  the zone of the Worker that made the request (empty, so removed, for a request no Worker made; our own Workers
  were observed with it empty in November 2026, and the WAF rule allows empty and `squadzr.app` only).
- **DNS for the API.** `api.squadzr.app` is a proxied CNAME to the Cloudflare Tunnel `squadzr-api`
  (`<tunnel id>.cfargotunnel.com`), not to a Railway domain. The tunnel, its token and its ingress rule are
  described in `docs/ops/catalog-import-railway.md`, "The tunnel", with how to rotate the token and how to roll
  back to a public Railway domain. The Workers keep calling `https://api.squadzr.app`: the rules below apply to
  tunnel traffic as they did to the public domain, and a Worker's subrequest still carries `x-real-ip` as the
  visitor's `CF-Connecting-IP`.
- **Rate limiting rule** (the one the Free plan allows): sign-in and OAuth callback of `api.squadzr.app`,
  5 requests per 10 seconds per IP. Every other route is limited by the API itself, per visitor
  (`docs/ops/catalog-import-railway.md`, "Abuse limits").
- **WAF custom rule**: blocks requests to `api.squadzr.app` made by another zone's Worker
  (`not cf.worker.upstream_zone in {"" "squadzr.app"}`).
- Bot Fight Mode and Turnstile are not used.
