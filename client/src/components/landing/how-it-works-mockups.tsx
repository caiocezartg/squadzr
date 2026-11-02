import type { ComponentType } from 'react'
import { CloseTeamMockup } from './close-team-mockup'
import { FindSquadMockup } from './find-squad-mockup'
import type { MockupProps } from './how-it-works-mockup-parts'
import { SignInMockup } from './sign-in-mockup'

/** The mockups in step order, each with a stable key. */
export const MOCKUPS: readonly {
  readonly id: string
  readonly Mockup: ComponentType<MockupProps>
}[] = [
  { id: 'sign-in', Mockup: SignInMockup },
  { id: 'find-squad', Mockup: FindSquadMockup },
  { id: 'close-team', Mockup: CloseTeamMockup },
]
