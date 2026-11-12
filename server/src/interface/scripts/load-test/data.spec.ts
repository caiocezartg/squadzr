import type pg from 'pg'
import { describe, expect, it } from 'vitest'
import { ForeignLinksError, cleanup, parseArguments } from './data'

/** A client that answers every foreign-link count with `foreign` and records every statement it runs. */
function fakeClient(foreign: number) {
  const statements: string[] = []
  const client = {
    query: (text: string) => {
      statements.push(text)
      if (text.startsWith('SELECT count(*)')) return Promise.resolve({ rows: [{ count: foreign }] })
      return Promise.resolve({ rows: [], rowCount: 2 })
    },
  } as unknown as pg.ClientBase
  return { client, statements }
}

const deletes = (statements: string[]) => statements.filter((text) => text.startsWith('DELETE'))

describe('cleanup guard', () => {
  it('deletes the run when nobody outside it is linked to its Squads', async () => {
    const { client, statements } = fakeClient(0)

    await cleanup(client, 'abc123')

    expect(deletes(statements)).toHaveLength(2)
    expect(statements).toContain('COMMIT')
  })

  it('counts the links first and deletes nothing when people outside the run are linked', async () => {
    const { client, statements } = fakeClient(2)

    const attempt = cleanup(client, 'abc123')

    await expect(attempt).rejects.toBeInstanceOf(ForeignLinksError)
    await expect(attempt).rejects.toMatchObject({
      counts: {
        squad_members: 2,
        squad_record_members: 2,
        squad_records_hosted_by_others: 2,
      },
    })
    expect(deletes(statements)).toHaveLength(0)
    expect(statements).not.toContain('BEGIN')
  })

  it('deletes anyway when the operator allows it', async () => {
    const { client, statements } = fakeClient(2)

    await cleanup(client, 'abc123', { allowForeignMembers: true })

    expect(deletes(statements)).toHaveLength(2)
  })

  it('does not reveal who is linked, only how many', async () => {
    const { client } = fakeClient(1)

    const error = await cleanup(client, 'abc123').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ForeignLinksError)
    expect((error as Error).message).toBe(
      'The cleanup would remove 3 links of people outside the run'
    )
  })
})

describe('parseArguments', () => {
  it('reads the flags the way the load test does: "--tag x" and "--tag=x" alike', () => {
    expect(parseArguments(['cleanup', '--tag', 'abc123'])).toMatchObject({ tag: 'abc123' })
    expect(parseArguments(['cleanup', '--tag=abc123'])).toMatchObject({ tag: 'abc123' })
    expect(parseArguments(['provision', '--tag=abc123', '--count=5'])).toMatchObject({ count: 5 })
  })

  it('takes the allow switch only on cleanup, and off by default', () => {
    expect(parseArguments(['cleanup', '--tag', 'abc123'])).toMatchObject({
      allowForeignMembers: false,
    })
    expect(parseArguments(['cleanup', '--tag', 'abc123', '--allow-foreign-members'])).toMatchObject(
      { allowForeignMembers: true }
    )
  })

  it('refuses a tag that could widen the selection and an unknown command', () => {
    expect(() => parseArguments(['cleanup', '--tag', '%'])).toThrow()
    expect(() => parseArguments(['drop'])).toThrow()
  })
})
