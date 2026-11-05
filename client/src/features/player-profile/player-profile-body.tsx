'use client'

import type { UseQueryResult } from '@tanstack/react-query'
import type { PlayerProfileDto } from '@squadzr/schemas'
import { useSession } from '@/hooks/use-session'
import { ApiClientError } from '@/lib/api'
import { ProfileHero } from './profile-hero'
import { ProfileIdentity } from './profile-identity'
import { EmptyHistory, ProfileLoadError, ProfileNotFound } from './profile-states'
import { ProfileSkeleton } from './profile-skeleton'
import { ProfileStats } from './profile-stats'
import { TopGames } from './top-games'

interface PlayerProfileBodyProps {
  readonly profile: UseQueryResult<PlayerProfileDto>
  readonly onClose: () => void
  /** The bottom sheet's layout. */
  readonly compact: boolean
}

/**
 * What the profile dialog shows for the state of its read: the cached profile at once (a background
 * read that fails keeps it), the skeleton only while nothing is cached, "not found" for a missing
 * person and a retry for any other failure.
 */
export function PlayerProfileBody(props: PlayerProfileBodyProps) {
  // The dialog and the sheet are flex columns that scroll; one block child keeps the header from shrinking in them.
  return (
    <div>
      <ProfileState {...props} />
    </div>
  )
}

function ProfileState({ profile: query, onClose, compact }: PlayerProfileBodyProps) {
  if (query.data) return <ProfileView profile={query.data} compact={compact} />

  if (query.isError) {
    const missing = query.error instanceof ApiClientError && query.error.status === 404
    return missing ? (
      <ProfileNotFound onClose={onClose} compact={compact} />
    ) : (
      <ProfileLoadError onRetry={() => void query.refetch()} compact={compact} />
    )
  }

  return <ProfileSkeleton compact={compact} />
}

function ProfileView({
  profile,
  compact,
}: {
  readonly profile: PlayerProfileDto
  readonly compact: boolean
}) {
  const viewerId = useSession()?.user.id
  const topGame = profile.topGames[0]

  return (
    <>
      <ProfileHero coverUrl={topGame?.game.coverUrl} compact={compact} />
      <ProfileIdentity
        playerId={profile.id}
        name={profile.name}
        image={profile.image}
        memberSince={profile.memberSince}
        compact={compact}
      />
      {profile.completedSquads === 0 ? (
        <EmptyHistory isOwn={viewerId === profile.id} name={profile.name} compact={compact} />
      ) : (
        <>
          <ProfileStats profile={profile} compact={compact} />
          <TopGames topGames={profile.topGames} compact={compact} />
        </>
      )}
    </>
  )
}
