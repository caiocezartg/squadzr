import { ApiClient } from './load-test/api-client'
import { DataSide } from './load-test/data-commands'
import { checkLimits } from './load-test/limits'
import { parseCli, parseDataCommand, USAGE, type RunOptions } from './load-test/options'
import { Scenario, type RunReport } from './load-test/scenario'
import { SocketFleet } from './load-test/socket-fleet'

/**
 * `bun src/interface/scripts/load-test.ts run --target https://api.squadzr.app --players 50`: N throwaway
 * players, each with a session and a WebSocket, make and join Squads while the Squad Board is read at a set
 * rate; it prints connected sockets, HTTP p50/p95 and the error rate. `limits` shows the API's abuse limits
 * answering from one address. The players exist only in the database next to the API (`railway-data.sh`),
 * and the run deletes them, their Squads and their Squad Records on the way out, also when it fails or is
 * interrupted. See docs/ops/catalog-import-railway.md, "Capacity".
 */

let interrupted = false

function onInterrupt(): void {
  if (interrupted) return
  interrupted = true
  console.error('Interrupted: stopping and cleaning up')
}

function printRun(report: RunReport): void {
  const board = report.board
  console.log(
    `\nplayers=${report.players} sockets_connected=${report.sockets.connected}/${report.sockets.attempted} ` +
      `sockets_open_now=${report.sockets.openNow} min_open_during_board=${report.minOpenDuringBoard}`
  )
  console.log(
    `board: requests=${board.requests} p50=${board.p50.toFixed(0)}ms p95=${board.p95.toFixed(0)}ms ` +
      `p99=${board.p99.toFixed(0)}ms error_rate=${(board.errorRate * 100).toFixed(2)}% statuses=${JSON.stringify(board.statuses)}`
  )
  console.log(`full report: ${JSON.stringify(report)}`)
}

async function run(options: RunOptions): Promise<number> {
  const api = new ApiClient(options.target, options.origin)
  const data = new DataSide(parseDataCommand(process.env), options.tag)
  const fleet = new SocketFleet(api.webSocketUrl, options.origin)
  let exitCode = 0
  console.log(`Run ${options.tag}: ${options.players} players against ${options.target}`)
  try {
    const players = await data.provision(options.players)
    const report = await new Scenario(options, api, fleet, players, () => interrupted).run()
    printRun(report)
    if (report.abortedFor || report.sockets.connected < options.players) exitCode = 1
  } catch (error) {
    console.error('Load test failed:', error instanceof Error ? error.message : error)
    exitCode = 1
  } finally {
    fleet.closeAll()
    exitCode = (await cleanUp(data)) ? exitCode : 1
  }
  return exitCode
}

/** Deletes the run and proves it: true when no tagged row remains. */
async function cleanUp(data: DataSide): Promise<boolean> {
  try {
    await data.cleanup()
    const verified = await data.verify()
    console.log(
      `cleanup: remaining=${JSON.stringify(verified.counts)} audit_entries_total=${verified.auditEntries} clean=${verified.clean}`
    )
    return verified.clean
  } catch (error) {
    console.error(
      'CLEANUP FAILED, rerun the data script cleanup:',
      error instanceof Error ? error.message : error
    )
    return false
  }
}

async function main(): Promise<number> {
  process.on('SIGINT', onInterrupt)
  process.on('SIGTERM', onInterrupt)
  const cli = parseCli(process.argv.slice(2))
  if (cli.mode === 'limits') {
    const { target, origin } = cli.options
    console.log(JSON.stringify(await checkLimits(target, origin, cli.options), null, 2))
    return 0
  }
  return run(cli.options)
}

main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((error) => {
    console.error(USAGE)
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 2
  })
