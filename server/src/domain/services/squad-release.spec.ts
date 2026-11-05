import { describe, expect, it } from 'vitest'
import { hostCandidateIds, planSquadRelease, type AffectedSquad } from './squad-release'

const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 12, minute))

function squad(roomId: string, hostId: string, members: [string, number][]): AffectedSquad {
  return {
    roomId,
    hostId,
    members: members.map(([userId, minute]) => ({ userId, joinedAt: at(minute) })),
  }
}

const idSet = (...ids: string[]) => new Set(ids)

describe('planSquadRelease', () => {
  it('only removes a leaver from a Squad whose host stays', () => {
    const [plan] = planSquadRelease({
      releasedUserIds: idSet('leaver'),
      squads: [
        squad('room-b', 'host', [
          ['host', 0],
          ['leaver', 1],
          ['stayer', 2],
        ]),
      ],
      hostingUserIds: idSet('host'),
    })

    expect(plan).toEqual({
      roomId: 'room-b',
      outcome: 'updated',
      removedUserIds: ['leaver'],
      remainingUserIds: ['host', 'stayer'],
      previousHostId: 'host',
      newHostId: null,
    })
  })

  it('hands the Squad to the oldest remaining member when the host leaves', () => {
    const [plan] = planSquadRelease({
      releasedUserIds: idSet('host'),
      squads: [
        squad('room-b', 'host', [
          ['host', 0],
          ['young', 5],
          ['old', 1],
        ]),
      ],
      hostingUserIds: new Set(),
    })

    expect(plan).toMatchObject({ outcome: 'updated', previousHostId: 'host', newHostId: 'old' })
  })

  it('skips a member who already hosts another Open Squad', () => {
    const [plan] = planSquadRelease({
      releasedUserIds: idSet('host'),
      squads: [
        squad('room-b', 'host', [
          ['host', 0],
          ['busy', 1],
          ['free', 2],
        ]),
      ],
      hostingUserIds: idSet('busy'),
    })

    expect(plan).toMatchObject({ outcome: 'updated', newHostId: 'free' })
  })

  it('closes a Squad whose remaining members all host another Open Squad', () => {
    const [plan] = planSquadRelease({
      releasedUserIds: idSet('host'),
      squads: [
        squad('room-b', 'host', [
          ['host', 0],
          ['busy-1', 1],
          ['busy-2', 2],
        ]),
      ],
      hostingUserIds: idSet('busy-1', 'busy-2'),
    })

    expect(plan).toEqual({
      roomId: 'room-b',
      outcome: 'closed',
      removedUserIds: ['host'],
      remainingUserIds: ['busy-1', 'busy-2'],
      previousHostId: 'host',
      newHostId: null,
    })
  })

  it('deletes a Squad nobody is left in', () => {
    const [plan] = planSquadRelease({
      releasedUserIds: idSet('host', 'leaver'),
      squads: [
        squad('room-b', 'host', [
          ['host', 0],
          ['leaver', 1],
        ]),
      ],
      hostingUserIds: new Set(),
    })

    expect(plan).toMatchObject({
      outcome: 'deleted',
      removedUserIds: ['host', 'leaver'],
      remainingUserIds: [],
      newHostId: null,
    })
  })

  it('gives a person who would inherit two Squads only the first, by id', () => {
    const plans = planSquadRelease({
      releasedUserIds: idSet('host-1', 'host-2'),
      squads: [
        squad('room-1', 'host-1', [
          ['host-1', 0],
          ['heir', 1],
          ['second', 9],
        ]),
        squad('room-2', 'host-2', [
          ['host-2', 0],
          ['heir', 1],
          ['third', 9],
        ]),
      ],
      hostingUserIds: new Set(),
    })

    expect(plans.map((plan) => plan.newHostId)).toEqual(['heir', 'third'])
  })

  it('closes the later Squad when its only other member was the heir of an earlier one', () => {
    const plans = planSquadRelease({
      releasedUserIds: idSet('host-1', 'host-2'),
      squads: [
        squad('room-1', 'host-1', [
          ['host-1', 0],
          ['heir', 1],
        ]),
        squad('room-2', 'host-2', [
          ['host-2', 0],
          ['heir', 1],
        ]),
      ],
      hostingUserIds: new Set(),
    })

    expect(plans.map((plan) => [plan.outcome, plan.newHostId])).toEqual([
      ['updated', 'heir'],
      ['closed', null],
    ])
  })

  it('plans the Squads in the order it is given', () => {
    const plans = planSquadRelease({
      releasedUserIds: idSet('leaver'),
      squads: [
        squad('room-1', 'a', [
          ['a', 0],
          ['leaver', 1],
        ]),
        squad('room-2', 'b', [
          ['b', 0],
          ['leaver', 1],
        ]),
      ],
      hostingUserIds: new Set(),
    })

    expect(plans.map((plan) => plan.roomId)).toEqual(['room-1', 'room-2'])
  })
})

describe('hostCandidateIds', () => {
  it('lists, once and in ascending order, the remaining members of Squads that lose their host', () => {
    const squads = [
      squad('room-1', 'gone', [
        ['gone', 0],
        ['zed', 1],
        ['amy', 2],
      ]),
      squad('room-2', 'gone', [
        ['gone', 0],
        ['amy', 1],
        ['leaver', 2],
      ]),
      squad('room-3', 'stays', [
        ['stays', 0],
        ['gone', 1],
        ['bystander', 2],
      ]),
    ]

    expect(hostCandidateIds(squads, idSet('gone', 'leaver'))).toEqual(['amy', 'zed'])
  })

  it('is empty when no Squad loses its host', () => {
    const squads = [
      squad('room-1', 'stays', [
        ['stays', 0],
        ['leaver', 1],
      ]),
    ]

    expect(hostCandidateIds(squads, idSet('leaver'))).toEqual([])
  })
})
