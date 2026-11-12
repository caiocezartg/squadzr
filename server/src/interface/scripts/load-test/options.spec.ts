import { describe, expect, it } from 'vitest'
import { parseCli, parseDataCommand, parseFlags } from './options'

describe('parseFlags', () => {
  it('reads "--name value" and "--name=value" pairs and camel-cases kebab names', () => {
    expect(parseFlags(['--target', 'https://api.example.com', '--duration-seconds=45'])).toEqual({
      target: 'https://api.example.com',
      durationSeconds: '45',
    })
  })

  it('refuses a flag without a value and a stray argument', () => {
    expect(() => parseFlags(['--target'])).toThrow('needs a value')
    expect(() => parseFlags(['--target', '--players', '5'])).toThrow('needs a value')
    expect(() => parseFlags(['players'])).toThrow('Unexpected argument')
  })
})

describe('parseCli', () => {
  it('parses a run with defaults and a generated tag', () => {
    const cli = parseCli(['run', '--target', 'https://api.example.com', '--players', '50'])

    expect(cli.mode).toBe('run')
    if (cli.mode !== 'run') return
    expect(cli.options).toMatchObject({
      players: 50,
      durationSeconds: 30,
      rps: 20,
      origin: 'https://squadzr.app',
    })
    expect(cli.options.tag).toMatch(/^[a-z0-9]{8}$/)
  })

  it('accepts a chosen tag and refuses one that could widen the cleanup', () => {
    const base = ['run', '--target', 'https://api.example.com', '--players', '10']

    expect(parseCli([...base, '--tag', 'abc123']).mode).toBe('run')
    expect(() => parseCli([...base, '--tag', '%'])).toThrow()
    expect(() => parseCli([...base, '--tag', 'AB_12'])).toThrow()
  })

  it.each([
    ['no target', ['run', '--players', '10']],
    ['a target that is not http(s)', ['run', '--target', 'ftp://x.example', '--players', '10']],
    ['no players', ['run', '--target', 'https://api.example.com']],
    ['one player', ['run', '--target', 'https://api.example.com', '--players', '1']],
    [
      'a non-numeric rate',
      ['run', '--target', 'https://a.example', '--players', '4', '--rps', 'x'],
    ],
    ['an unknown mode', ['stress', '--target', 'https://api.example.com']],
  ])('refuses %s', (_label, argv) => {
    expect(() => parseCli(argv)).toThrow()
  })

  it('parses the limits mode with the documented defaults', () => {
    const cli = parseCli(['limits', '--target', 'https://api.example.com'])

    expect(cli).toMatchObject({
      mode: 'limits',
      options: { requestLimit: 300, upgradeLimit: 20, socketLimit: 10, cooldownSeconds: 65 },
    })
  })
})

describe('parseDataCommand', () => {
  it('requires the data command in the environment', () => {
    expect(parseDataCommand({ LOAD_TEST_DATA_COMMAND: 'bash railway-data.sh' })).toBe(
      'bash railway-data.sh'
    )
    expect(() => parseDataCommand({})).toThrow()
    expect(() => parseDataCommand({ LOAD_TEST_DATA_COMMAND: '' })).toThrow()
  })
})
