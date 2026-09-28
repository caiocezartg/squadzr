import { describe, expect, expectTypeOf, it } from 'vitest'
import * as apiTypes from './api'
import * as sharedTypes from './index'
import type { Game, Room, RoomMember, User, UserNotification } from './index'
import type { UserNotificationPayload } from './index'
import * as wsTypes from './ws'

// @squadzr/types is intentionally type-only (ADR-0001): every export is a static
// contract with no runtime representation, so its entry points expose an empty
// namespace at runtime. The suite therefore verifies the contracts through
// type-level assertions checked by `tsc --noEmit`, while keeping the project
// executable in Node. Room lifecycle details planned for later issues
// (CCC-35) are deliberately not pinned here.
describe('@squadzr/types', () => {
  it('loads every contract entry point in Node', () => {
    expect(sharedTypes).toBeTypeOf('object')
    expect(apiTypes).toBeTypeOf('object')
    expect(wsTypes).toBeTypeOf('object')
  })

  it('keeps the shared entity contracts stable at the type level', () => {
    expectTypeOf<User['id']>().toEqualTypeOf<string>()
    expectTypeOf<User['image']>().toEqualTypeOf<string | null>()
    expectTypeOf<Game['minPlayers']>().toEqualTypeOf<number>()
    expectTypeOf<Room['tags']>().toEqualTypeOf<string[]>()
    expectTypeOf<RoomMember['joinedAt']>().toEqualTypeOf<Date>()
    expectTypeOf<UserNotification['payload']>().toEqualTypeOf<UserNotificationPayload>()
  })
})
