import { describe, expect, it } from 'vitest'
import { groupMessages, GROUP_WINDOW_MS } from './group-messages'
import type { SquadChatMessage } from './squad-chat-message'

const ANA = { id: 'ana', name: 'Ana', image: null }
const BEN = { id: 'ben', name: 'Ben', image: 'https://x.test/b.png' }

let sequence = 0
function message(author: SquadChatMessage['author'], createdAt: string, pending = false) {
  sequence += 1
  return { id: `m${sequence}`, body: `body ${sequence}`, createdAt, author, pending }
}

const OPTIONS = { viewerId: 'ana', timeZone: 'UTC', now: new Date('2026-06-01T12:00:00.000Z') }

describe('groupMessages', () => {
  it('returns nothing for no messages', () => {
    expect(groupMessages([], OPTIONS)).toEqual([])
  })

  it('opens with the day divider and one group for a single message', () => {
    const only = message(ANA, '2026-06-01T10:00:00.000Z')

    expect(groupMessages([only], OPTIONS)).toEqual([
      { kind: 'day', key: 'day:2026-06-01', dayKey: '2026-06-01', isToday: true },
      { kind: 'group', key: 'group:m' + sequence, author: ANA, own: true, messages: [only] },
    ])
  })

  it('groups consecutive messages of one author within two minutes', () => {
    const first = message(BEN, '2026-06-01T10:00:00.000Z')
    const second = message(BEN, '2026-06-01T10:01:30.000Z')
    const third = message(BEN, '2026-06-01T10:03:30.000Z')

    const entries = groupMessages([first, second, third], OPTIONS)

    const groups = entries.filter((entry) => entry.kind === 'group')
    expect(groups).toHaveLength(1)
    expect(groups[0]?.messages).toEqual([first, second, third])
    expect(groups[0]?.own).toBe(false)
  })

  it('measures the window from the previous message, inclusive of exactly two minutes', () => {
    const first = message(BEN, '2026-06-01T10:00:00.000Z')
    const second = message(
      BEN,
      new Date(Date.parse(first.createdAt) + GROUP_WINDOW_MS).toISOString()
    )

    const groups = groupMessages([first, second], OPTIONS).filter((entry) => entry.kind === 'group')

    expect(groups).toHaveLength(1)
  })

  it('starts a new group after a gap longer than two minutes', () => {
    const first = message(BEN, '2026-06-01T10:00:00.000Z')
    const second = message(BEN, '2026-06-01T10:02:00.001Z')

    const groups = groupMessages([first, second], OPTIONS).filter((entry) => entry.kind === 'group')

    expect(groups.map((group) => group.messages)).toEqual([[first], [second]])
  })

  it('starts a new group when the author changes', () => {
    const a1 = message(ANA, '2026-06-01T10:00:00.000Z')
    const b1 = message(BEN, '2026-06-01T10:00:10.000Z')
    const a2 = message(ANA, '2026-06-01T10:00:20.000Z')

    const groups = groupMessages([a1, b1, a2], OPTIONS).filter((entry) => entry.kind === 'group')

    expect(groups.map((group) => group.author.id)).toEqual(['ana', 'ben', 'ana'])
    expect(groups.map((group) => group.own)).toEqual([true, false, true])
  })

  it('inserts a day divider when the day changes and breaks the group there', () => {
    const late = message(BEN, '2026-05-31T23:59:30.000Z')
    const early = message(BEN, '2026-06-01T00:00:10.000Z')

    const entries = groupMessages([late, early], OPTIONS)

    expect(entries.map((entry) => entry.kind)).toEqual(['day', 'group', 'day', 'group'])
    expect(entries[0]).toMatchObject({ dayKey: '2026-05-31', isToday: false })
    expect(entries[2]).toMatchObject({ dayKey: '2026-06-01', isToday: true })
  })

  it('reads the day in the given time zone', () => {
    const message1 = message(BEN, '2026-06-01T02:30:00.000Z')

    const [day] = groupMessages([message1], { ...OPTIONS, timeZone: 'America/Sao_Paulo' })

    expect(day).toMatchObject({ kind: 'day', dayKey: '2026-05-31' })
  })

  it('marks a pending message of the viewer as own and keeps it in the last group', () => {
    const sent = message(ANA, '2026-06-01T10:00:00.000Z')
    const pending = message(ANA, '2026-06-01T10:00:20.000Z', true)

    const groups = groupMessages([sent, pending], OPTIONS).filter((entry) => entry.kind === 'group')

    expect(groups).toHaveLength(1)
    expect(groups[0]?.messages.at(-1)?.pending).toBe(true)
  })

  it('gives every entry a distinct key', () => {
    const entries = groupMessages(
      [
        message(ANA, '2026-05-30T10:00:00.000Z'),
        message(BEN, '2026-05-30T10:00:05.000Z'),
        message(ANA, '2026-06-01T10:00:00.000Z'),
      ],
      OPTIONS
    )

    expect(new Set(entries.map((entry) => entry.key)).size).toBe(entries.length)
  })
})
