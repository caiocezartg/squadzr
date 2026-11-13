// Rotates EDGE_AUTH_TOKEN, the origin-lock secret, in the four places that hold it: the Railway variable on
// `api`, the Cloudflare Transform Rule on api.squadzr.app, and the Worker secrets of `squadzr-web` and
// `squadzr-og`. Background: docs/ops/client-on-cloudflare-workers.md, "The edge secret".
//
// Needs, on PATH: the `railway` CLI (logged in, and linked from the repository root:
// `railway link --project squadzr --environment production`) and the `cf` CLI (logged in, with access to the
// squadzr.app zone and both Workers). Nothing else is read from the machine.
//
//   bun scripts/rotate-edge-token.mjs rotate-dry   check the rule with --validate-only; changes nothing
//   bun scripts/rotate-edge-token.mjs rotate       new token everywhere, then watch the site for a short while
//   bun scripts/rotate-edge-token.mjs revert       WARNING: removes EDGE_AUTH_TOKEN from Railway and redeploys
//                                                  `api`. That turns the origin lock OFF. Emergency use only.
//
// The token is made in memory. It is never printed, logged, put on a command line or committed: it reaches
// the commands only through 0600 files in a private temporary directory (deleted in `finally`) and stdin.
// Runs with `node` too (`node scripts/rotate-edge-token.mjs <mode>`).
import { spawn, spawnSync } from 'node:child_process'
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
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const log = (...args) => console.log(new Date().toISOString(), ...args)

// `railway` and `cf` are .cmd shims on Windows, which only a shell can start. The arguments are fixed words
// and temporary paths, never the token, so joining them into one command line is safe.
const isWin = process.platform === 'win32'
const quote = (arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg)
const command = (cmd, args, extra) =>
  isWin ? [[cmd, ...args].map(quote).join(' '), [], { ...extra, shell: true }] : [cmd, args, extra]

const tail = (text, lines) => text.trim().split('\n').slice(-lines).join(' | ').slice(0, 200)

/** Runs a command and throws unless it exits 0. Logs only the exit code and a short tail of its output. */
function run(label, cmd, args, { input, cwd = ROOT } = {}) {
  const [file, fileArgs, opts] = command(cmd, args, { input, cwd, encoding: 'utf8' })
  const res = spawnSync(file, fileArgs, opts)
  log(`${label}: exit=${res.status} ${tail(`${res.stdout ?? ''}${res.stderr ?? ''}`, 3)}`)
  if (res.status !== 0) throw new Error(`${label} failed`)
}

/** The same without blocking the event loop, so the site probes keep sampling while the command runs. */
function runAsync(label, cmd, args) {
  return new Promise((resolve, reject) => {
    const [file, fileArgs, opts] = command(cmd, args, { cwd: ROOT })
    const child = spawn(file, fileArgs, opts)
    let out = ''
    child.stdout.on('data', (chunk) => (out += chunk))
    child.stderr.on('data', (chunk) => (out += chunk))
    child.on('close', (code) => {
      log(`${label}: exit=${code} ${tail(out, 2)}`)
      code === 0 ? resolve() : reject(new Error(`${label} failed`))
    })
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

const ruleArgs = (file, validateOnly) => [
  'rulesets',
  'rules',
  'update',
  RULE,
  '--zone',
  ZONE,
  '--ruleset-id',
  RULESET,
  '--body',
  `@${file}`,
  ...(validateOnly ? ['--validate-only'] : []),
]

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
    async stop() {
      running = false
      await loop
      await sleep(6000) // let the last samples land
      const failed = samples.filter((result) => result !== '200')
      return `${failed.length} of ${samples.length} samples failed${failed.length ? ` (${[...new Set(failed)].join(', ')})` : ''}`
    },
  }
}

/** Waits until a new API container serves: the uptime drops below the one seen before the variable changed. */
async function waitForNewContainer(before, startedAt) {
  let redeployed = false
  while (Date.now() - startedAt < 9 * 60_000) {
    const up = await uptime()
    if (up !== null && before !== null && up < before - 5 && up < 120) return
    if (!redeployed && Date.now() - startedAt > 4 * 60_000) {
      redeployed = true
      log('deploy looks stuck: redeploying from source')
      run('railway: redeploy', 'railway', [
        'redeploy',
        '--service',
        'api',
        '--from-source',
        '--yes',
      ])
    }
    await sleep(250)
  }
  throw new Error('the API never switched to the new container')
}

const privateFile = (dir, name, content) => {
  const file = join(dir, name)
  writeFileSync(file, content, { mode: 0o600 })
  return file
}

async function rotate(dir, token) {
  const secretsFile = privateFile(
    dir,
    'secrets.json',
    JSON.stringify({ EDGE_AUTH_TOKEN: { type: 'secret_text', text: token } })
  )
  const ruleFile = privateFile(dir, 'rule.json', ruleBody(token))

  // 1. Railway first: the variable starts a deploy, and the old container keeps enforcing the old token until
  //    the new one is healthy, so visitors notice nothing yet.
  const before = await uptime()
  const probe = startProbe()
  const startedAt = Date.now()
  run(
    'railway: set EDGE_AUTH_TOKEN (starts the deploy)',
    'railway',
    ['variable', 'set', 'EDGE_AUTH_TOKEN', '--stdin', '--service', 'api'],
    { input: token }
  )

  // 2. When the new container serves, switch both Worker secrets and the Transform Rule together.
  await waitForNewContainer(before, startedAt)
  log('the new API container is serving')
  await Promise.all([
    runAsync('squadzr-web: secret', 'cf', [
      'workers',
      'secrets',
      'bulk',
      '--worker',
      'squadzr-web',
      '--secrets',
      `@${secretsFile}`,
    ]),
    runAsync('squadzr-og: secret', 'cf', [
      'workers',
      'secrets',
      'bulk',
      '--worker',
      'squadzr-og',
      '--secrets',
      `@${secretsFile}`,
    ]),
    runAsync('transform rule', 'cf', ruleArgs(ruleFile, false)),
  ])

  // 3. Watch the site for a short while.
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
try {
  if (mode === 'revert') {
    // Deleting a variable does not redeploy, so redeploy `api` to make the lock go off.
    run('railway: remove EDGE_AUTH_TOKEN', 'railway', [
      'variable',
      'delete',
      'EDGE_AUTH_TOKEN',
      '--service',
      'api',
    ])
    run('railway: redeploy api', 'railway', ['redeploy', '--service', 'api', '--yes'])
  } else if (mode === 'rotate-dry') {
    const ruleFile = privateFile(dir, 'rule.json', ruleBody(randomBytes(36).toString('base64url')))
    run('transform rule (validate-only)', 'cf', ruleArgs(ruleFile, true))
  } else {
    await rotate(dir, randomBytes(36).toString('base64url')) // 48 visible ASCII characters
  }
  log(`done (${mode})`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
