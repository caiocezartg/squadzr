import { z } from 'zod'
import { tagSchema } from './cleanup-plan'

const httpUrlSchema = z.url().refine((value) => /^https?:\/\//.test(value), 'must be http(s)')

const wholeNumber = (min: number, max: number) => z.coerce.number().int().min(min).max(max)

function randomTag(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(8, '0')
}

/**
 * `--players 50` or `--players=50` pairs, with kebab-case names turned into camelCase. A name listed in
 * `switches` takes no value and reads as "true" (`--allow-foreign-members`).
 */
export function parseFlags(
  argv: readonly string[],
  switches: readonly string[] = []
): Record<string, string> {
  const flags: Record<string, string> = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? ''
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument "${arg}"`)
    const [rawName = '', inline] = arg.slice(2).split('=', 2)
    const name = rawName.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
    if (inline === undefined && switches.includes(rawName)) {
      flags[name] = 'true'
      continue
    }
    const value = inline ?? argv[i + 1]
    if (value === undefined || (inline === undefined && value.startsWith('--'))) {
      throw new Error(`Flag --${rawName} needs a value`)
    }
    if (inline === undefined) i += 1
    flags[name] = value
  }
  return flags
}

const sharedSchema = z.object({
  /** The API under test: `https://api.squadzr.app`, or a local server. */
  target: httpUrlSchema,
  /** The `Origin` the requests claim; the API's CORS and CSRF checks expect the app's own. */
  origin: httpUrlSchema.default('https://squadzr.app'),
})

export const runOptionsSchema = sharedSchema.extend({
  /** Players, each with a session and a WebSocket. */
  players: wholeNumber(2, 5000),
  /** How long the Squad Board is read once everyone is connected. */
  durationSeconds: wholeNumber(1, 3600).default(30),
  /** Squad Board reads per second, across all players. */
  rps: wholeNumber(1, 5000).default(20),
  /** Players connected, and Squads made, per second while the run ramps up. */
  rampPerSecond: wholeNumber(1, 500).default(20),
  /** The run's mark on every row it creates. */
  tag: tagSchema.default(randomTag),
  /** A real, permanent Discord invite: the API asks Discord before it accepts a Squad. */
  discordInvite: httpUrlSchema.default('https://discord.gg/discord-api'),
  /** Stop early when this share of the board reads fail. */
  abortErrorRate: z.coerce.number().min(0).max(1).default(0.5),
})

export type RunOptions = z.infer<typeof runOptionsSchema>

export const limitsOptionsSchema = sharedSchema.extend({
  /** The limits under test, as the API is configured (`RATE_LIMIT_MAX`, upgrades and sockets). */
  requestLimit: wholeNumber(1, 100_000).default(300),
  upgradeLimit: wholeNumber(1, 10_000).default(20),
  socketLimit: wholeNumber(1, 10_000).default(10),
  /** One address family for every connection, so the checks come from one client address. */
  ipFamily: z
    .enum(['4', '6'])
    .default('4')
    .transform((family) => (family === '4' ? (4 as const) : (6 as const))),
  /** Wait between the checks so each one starts in a fresh minute. */
  cooldownSeconds: wholeNumber(0, 600).default(65),
})

export type LimitsOptions = z.infer<typeof limitsOptionsSchema>

/**
 * The shell command that reaches the database side (`railway-data.sh`). The run appends the data script's
 * own arguments (`provision --tag t --count 50`, `cleanup --tag t`, `verify --tag t`). Required for a run.
 */
export const dataCommandEnvSchema = z.object({ LOAD_TEST_DATA_COMMAND: z.string().min(1) })

export function parseDataCommand(env: Record<string, string | undefined>): string {
  return dataCommandEnvSchema.parse(env).LOAD_TEST_DATA_COMMAND
}

const modeSchema = z.enum(['run', 'limits'])

export type Mode = z.infer<typeof modeSchema>

export type ParsedCli =
  | { readonly mode: 'run'; readonly options: RunOptions }
  | { readonly mode: 'limits'; readonly options: LimitsOptions }

export function parseCli(argv: readonly string[]): ParsedCli {
  const [rawMode, ...rest] = argv
  const mode = modeSchema.parse(rawMode)
  const flags = parseFlags(rest)
  return mode === 'run'
    ? { mode, options: runOptionsSchema.parse(flags) }
    : { mode, options: limitsOptionsSchema.parse(flags) }
}

export const USAGE = `Usage:
  bun load-test.ts run    --target <url> --players <N> [--duration-seconds 30] [--rps 20]
                          [--ramp-per-second 20] [--tag <a-z0-9>] [--discord-invite <url>]
  bun load-test.ts limits --target <url> [--request-limit 300] [--upgrade-limit 20]
                          [--socket-limit 10] [--ip-family 4] [--cooldown-seconds 65]

A run needs LOAD_TEST_DATA_COMMAND in the environment: the shell command that runs the data script
(railway-data.sh) next to the database. The run appends provision, cleanup and verify to it.`
