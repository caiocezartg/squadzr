// Rotates EDGE_AUTH_TOKEN, the origin-lock secret, in the four places that hold it: the Railway variable on
// `api`, the Cloudflare Transform Rule on api.squadzr.app, and the Worker secrets of `squadzr-web` and
// `squadzr-og`. Background: docs/ops/client-on-cloudflare-workers.md, "The edge secret".
//
// Needs, on PATH: the `railway` CLI (logged in, and linked from the repository root:
// `railway link --project squadzr --environment production`) and the `cf` CLI (logged in, with access to the
// squadzr.app zone and both Workers). Nothing else is read from the machine.
//
//   bun scripts/rotate-edge-token.mjs rotate-dry   dry-runs the rule and both Worker secrets; changes nothing
//   bun scripts/rotate-edge-token.mjs rotate       new token everywhere, then watch the site for a short while
//   bun scripts/rotate-edge-token.mjs revert       WARNING: removes EDGE_AUTH_TOKEN from Railway and redeploys
//                                                  `api`. That turns the origin lock OFF. Emergency use only.
//
// The token is made in memory. It is never printed, logged, put on a command line or committed: it reaches
// the commands only through 0600 files in a private temporary directory (deleted in `finally`) and stdin, and
// everything a command prints is stripped of it before it is logged or thrown.
// If `rotate` fails after Railway has the new token, it says so and tells you to run it again or revert: a failed
// Cloudflare write prints PRODUCTION INCONSISTENT, a deploy that never serves prints its own message.
// Expect a few seconds of 403 in `rotate`: the API accepts one token, so requests fail between the new container
// serving and the three Cloudflare writes finishing. Dual-token support was left out on purpose.
// Verified with cf 1.0.0-beta.31 and railway 5.71.0.
// Runs with `node` too (`node scripts/rotate-edge-token.mjs <mode>`).
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MODES = ['rotate-dry', 'rotate', 'revert']
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ZONE = '29d1bd618531a78681bf8e103f124b8a'
const RULESET = '9c6ffb169b624ebfa518cfd8a1170543'
const RULE = '3331b8035a214ec5a5dc06b37de66e54'
const CF_ATTEMPTS = 3
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const log = (...args) => console.log(new Date().toISOString(), ...args)

// `railway` and `cf` are .cmd shims on Windows, which only a shell can start. The arguments are fixed words
// and temporary paths (checked below), never the token, so joining them into one command line is safe.
const isWin = process.platform === 'win32'
const command = (cmd, args) =>
  isWin ? [[cmd, ...args].join(' '), [], { shell: true }] : [cmd, args, {}]

// Always redact the whole output first and cut after: a cut first could leave half a token in the log.
const tail = (text, lines) => text.trim().split('\n').slice(-lines).join(' | ').slice(0, 200)

/**
 * Runs a command and rejects unless it exits 0. Whatever it prints is stripped of the token before it is logged
 * or put in an error. A `silent` command (the Cloudflare writes, whose output echoes the rule or the secrets)
 * logs nothing on success, and on failure only a tail of its stderr.
 */
function runCommand(label, cmd, args, { input, token, silent = false } = {}) {
  const redact = (text) => (token ? text.split(token).join('[redacted]') : text)
  return new Promise((resolve, reject) => {
    const [file, fileArgs, opts] = command(cmd, args)
    const child = spawn(file, fileArgs, { ...opts, cwd: ROOT })
    let out = ''
    let err = ''
    child.stdout.on('data', (chunk) => (out += chunk))
    child.stderr.on('data', (chunk) => (err += chunk))
    child.on('error', (error) =>
      reject(new Error(redact(`${label} could not start: ${error.message}`)))
    )
    child.on('close', (code) => {
      if (code === 0) {
        log(silent ? `${label}: ok` : `${label}: ok ${tail(redact(out + err), 3)}`)
        return resolve(out)
      }
      reject(
        new Error(`${label} failed (exit ${code}) ${tail(redact(silent ? err : out + err), 3)}`)
      )
    })
    child.stdin.on('error', () => {}) // the command may exit before it reads its input
    child.stdin.end(input)
  })
}

const ruleBody = (token) =>
  JSON.stringify({
    action: 'rewrite',
    description: 'Origin lock: set the edge secret header on every request to the API host',
    enabled: true,
    expression: '(http.host eq "api.squadzr.app")',
    action_parameters: {
      headers: {
        'x-squadzr-edge-auth': { operation: 'set', value: token },
        'x-squadzr-worker-zone': { operation: 'set', expression: 'cf.worker.upstream_zone' },
      },
    },
  })

const secretsBody = (token) =>
  JSON.stringify({
    EDGE_AUTH_TOKEN: { type: 'secret_text', text: token },
  })

/** The three Cloudflare writes. `dryRun` asks each command to validate and change nothing. */
function cloudflareWrites(token, files, dryRun) {
  const secret = (worker) => [
    'workers',
    'secrets',
    'bulk',
    '--worker',
    worker,
    '--secrets',
    `@${files.secrets}`,
    ...(dryRun ? ['--dry-run'] : []),
  ]
  return {
    'squadzr-web secret': secret('squadzr-web'),
    'squadzr-og secret': secret('squadzr-og'),
    'Transform Rule': [
      'rulesets',
      'rules',
      'update',
      RULE,
      '--zone',
      ZONE,
      '--ruleset-id',
      RULESET,
      '--body',
      `@${files.rule}`,
      ...(dryRun ? ['--validate-only'] : []),
    ],
  }
}

/** Runs one Cloudflare write, trying again while the temporary files still exist. */
async function writeWithRetry(label, args, token) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await runCommand(label, 'cf', args, { token, silent: true })
    } catch (error) {
      if (attempt === CF_ATTEMPTS) throw error
      log(`${error.message}; trying again`)
      await sleep(2000)
    }
  }
}

/** The API's uptime in seconds, or null while it does not answer 200. A new container restarts the count. */
async function uptime() {
  try {
    const res = await fetch('https://api.squadzr.app/health/ready', {
      signal: AbortSignal.timeout(3000),
    })
    return res.status === 200 ? Math.round((await res.json()).uptime) : null
  } catch {
    return null
  }
}

/** Samples every 2 s what a visitor sees (the browser path to the API, 30 requests a minute, far under the
 *  API's limit of 300). A sample is the status code or the class of the failure. */
function startProbe() {
  const samples = []
  let running = true
  const sample = () =>
    fetch('https://api.squadzr.app/api/games?limit=1', { signal: AbortSignal.timeout(5000) })
      .then((res) => String(res.status))
      .catch((err) => `err:${err?.name ?? 'unknown'}`)
      .then((result) => samples.push(result))
  const loop = (async () => {
    while (running) {
      void sample()
      await sleep(2000)
    }
  })()
  return {
    halt: () => void (running = false),
    async stop() {
      running = false
      await loop
      await sleep(6000) // let the last samples land
      const failed = samples.filter((result) => result !== '200')
      return `${failed.length} of ${samples.length} samples failed${failed.length ? ` (${[...new Set(failed)].join(', ')})` : ''}`
    },
  }
}

/** True when the newest `api` deployment is still BUILDING (a stuck build, not a slow start). */
async function newestDeployIsBuilding() {
  try {
    const args = ['deployment', 'list', '--service', 'api', '--limit', '1', '--json']
    const list = JSON.parse(
      await runCommand('railway: deployment status', 'railway', args, { silent: true })
    )
    return list[0]?.status === 'BUILDING'
  } catch {
    return false
  }
}

/**
 * Waits until a new API container serves: the uptime drops below the one seen before the variable changed.
 * `redeploy --from-source` deploys the latest commit of the configured branch, which can be newer than what
 * is running.
 */
async function waitForNewContainer(before, startedAt, token) {
  let redeployed = false
  let nextCheck = startedAt + 4 * 60_000
  while (Date.now() - startedAt < 9 * 60_000) {
    const up = await uptime()
    if (up !== null && up < before - 5 && up < 120) return
    if (!redeployed && Date.now() >= nextCheck) {
      nextCheck = Date.now() + 60_000
      if (await newestDeployIsBuilding()) {
        redeployed = true
        log('the deploy is stuck in BUILDING: redeploying from source')
        const args = ['redeploy', '--service', 'api', '--from-source', '--yes']
        await runCommand('railway: redeploy', 'railway', args, { token })
      }
    }
    await sleep(250)
  }
  throw new Error('no new API container served within 9 minutes')
}

const privateFile = (dir, name, content) => {
  const file = join(dir, name)
  writeFileSync(file, content, { mode: 0o600 })
  return file
}

const makeFiles = (dir, token) => ({
  secrets: privateFile(dir, 'secrets.json', secretsBody(token)),
  rule: privateFile(dir, 'rule.json', ruleBody(token)),
})

async function rehearse(dir) {
  const token = randomBytes(36).toString('base64url')
  const writes = cloudflareWrites(token, makeFiles(dir, token), true)
  for (const [label, args] of Object.entries(writes)) {
    await runCommand(`${label} (dry run)`, 'cf', args, { token, silent: true })
  }
}

/** Switches the three Cloudflare places together. Every attempt ends before the temporary files go. */
async function switchCloudflare(dir, token) {
  const writes = Object.entries(cloudflareWrites(token, makeFiles(dir, token), false))
  const results = await Promise.allSettled(
    writes.map(([label, args]) => writeWithRetry(label, args, token))
  )
  const done = writes.filter((_, i) => results[i].status === 'fulfilled').map(([label]) => label)
  const missing = writes.filter((_, i) => results[i].status === 'rejected').map(([label]) => label)
  if (missing.length) {
    throw new Error(
      `PRODUCTION INCONSISTENT: Railway has the new token, Cloudflare (${missing.join(', ')}) does not. ` +
        `New token in: Railway${done.map((label) => `, ${label}`).join('')}. ` +
        'Run rotate again (it makes a fresh token for all 4 places) or revert.'
    )
  }
}

async function rotate(dir) {
  const token = randomBytes(36).toString('base64url') // 48 visible ASCII characters
  // Nothing has changed yet, so stop here if the API is not healthy: a new deploy could not be told apart.
  const before = await uptime()
  if (before === null)
    throw new Error('/health/ready does not answer 200. Nothing was changed; try again later.')

  const probe = startProbe()
  try {
    await switchTokens(before, probe, dir, token)
  } finally {
    probe.halt() // a failure must not leave the sampling loop keeping the process alive
  }
}

async function switchTokens(before, probe, dir, token) {
  const startedAt = Date.now()
  // 1. Railway first: the variable starts a deploy, and the old container keeps enforcing the old token until
  //    the new one is healthy, and the Workers and the rule still send that old token, so nothing fails yet.
  await runCommand(
    'railway: set EDGE_AUTH_TOKEN (starts the deploy)',
    'railway',
    ['variable', 'set', 'EDGE_AUTH_TOKEN', '--stdin', '--service', 'api'],
    { input: token, token }
  ).catch((error) => {
    throw new Error(
      `${error.message}. Cloudflare was not touched. Check the Railway variable, then run rotate again.`
    )
  })

  // 2. From here Railway holds the new token: any failure must say so.
  try {
    await waitForNewContainer(before, startedAt, token)
  } catch (error) {
    throw new Error(
      `${error.message}. Railway already holds the NEW token and Cloudflare the OLD one. The slow or stuck deploy ` +
        'can finish at any moment, and then every request fails with 403. Run rotate or revert RIGHT NOW.'
    )
  }
  log('the new API container is serving')

  // 3. Switch both Worker secrets and the Transform Rule together.
  await switchCloudflare(dir, token)

  // 4. Watch the site for a short while.
  await sleep(20_000)
  log(`site probe: ${await probe.stop()}`)
}

const mode = process.argv[2]
if (!MODES.includes(mode)) {
  console.error(
    `usage: rotate-edge-token.mjs <${MODES.join(' | ')}>  (see the header of this file)`
  )
  process.exit(1)
}

const dir = mkdtempSync(join(tmpdir(), 'edge-token-'))
// Ctrl+C skips `finally`: clean up here and say what state production may be in.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    rmSync(dir, { recursive: true, force: true })
    console.error(
      'Interrupted. If rotate had started, production may be inconsistent: run rotate again or revert.'
    )
    process.exit(130)
  })
}
try {
  // On Windows the commands run through a shell with only simple quoting: refuse paths it could misread.
  if (isWin && !/^[\w:\\/.-]+$/.test(dir))
    throw new Error(`the temporary directory path has unsupported characters: ${dir}`)
  if (mode === 'revert') {
    // Deleting a variable does not redeploy, so redeploy `api` to make the lock go off.
    await runCommand('railway: remove EDGE_AUTH_TOKEN', 'railway', [
      'variable',
      'delete',
      'EDGE_AUTH_TOKEN',
      '--service',
      'api',
    ])
    await runCommand('railway: redeploy api', 'railway', ['redeploy', '--service', 'api', '--yes'])
  } else if (mode === 'rotate-dry') {
    await rehearse(dir)
  } else {
    await rotate(dir)
  }
  log(`done (${mode})`)
} catch (error) {
  console.error(new Date().toISOString(), error.message)
  process.exitCode = 1
} finally {
  rmSync(dir, { recursive: true, force: true })
}
