import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { filterRecruitingSquads } from '@/lib/squad-discovery'
import { squadsSearchSchema } from '@/lib/squads-search'
import { SquadCard } from '@/components/squads/squad-card'
import { AlertBox } from '@/components/ui/alert-box'
import type { Game, PublicRecruitingSquad } from '@squadzr/types'

type SquadsResponse = { squads: PublicRecruitingSquad[] }
type GamesResponse = { games: Game[] }

export const Route = createFileRoute('/squads/')({
  component: SquadsPage,
  validateSearch: (raw) => squadsSearchSchema.parse(raw),
})

function SquadsPage() {
  const search = useSearch({ from: '/squads/' })
  const navigate = useNavigate({ from: '/squads/' })
  const squadsQuery = useQuery({
    queryKey: ['squads', 'recruiting'],
    queryFn: () => api.get<SquadsResponse>('/api/squads'),
  })
  const gamesQuery = useQuery({
    queryKey: ['games'],
    queryFn: () => api.get<GamesResponse>('/api/games'),
    staleTime: 60_000,
  })

  const games = useMemo(
    () => new Map((gamesQuery.data?.games ?? []).map((game) => [game.id, game])),
    [gamesQuery.data]
  )
  const squads = useMemo(() => {
    return filterRecruitingSquads(squadsQuery.data?.squads ?? [], games, search)
  }, [games, search, squadsQuery.data])

  const updateSearch = (updates: Partial<typeof search>) => {
    navigate({
      search: (previous) => ({ ...previous, ...updates }),
      replace: true,
    })
  }

  if (squadsQuery.isLoading || gamesQuery.isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-sm text-muted">
        Loading Recruiting Squads…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">Recruiting Squads</h1>
        <p className="mt-1 text-sm text-muted">
          {squads.length} Squad{squads.length === 1 ? '' : 's'} ready for new Memberships.
        </p>
      </div>

      {(squadsQuery.isError || gamesQuery.isError) && (
        <div className="mb-6">
          <AlertBox type="error" message="Could not load Recruiting Squads." />
        </div>
      )}

      <div className="mb-6 grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
        <input
          className="input"
          value={search.search ?? ''}
          onChange={(event) => updateSearch({ search: event.target.value })}
          placeholder="Search Squad or game"
        />
        <input
          className="input"
          value={search.tag ?? ''}
          onChange={(event) => updateSearch({ tag: event.target.value })}
          placeholder="Filter by tag"
        />
        <select
          className="input"
          value={search.language ?? 'all'}
          onChange={(event) =>
            updateSearch({ language: event.target.value as 'all' | 'pt-br' | 'en' })
          }
        >
          <option value="all">All languages</option>
          <option value="pt-br">Português</option>
          <option value="en">English</option>
        </select>
        <select
          className="input"
          value={search.capacity ?? 'all'}
          onChange={(event) =>
            updateSearch({ capacity: event.target.value as 'all' | 'almost-full' })
          }
        >
          <option value="all">Any capacity</option>
          <option value="almost-full">Almost full</option>
        </select>
        <select
          className="input"
          value={search.sort ?? 'newest'}
          onChange={(event) =>
            updateSearch({ sort: event.target.value as 'newest' | 'expires-soon' })
          }
        >
          <option value="newest">Newest</option>
          <option value="expires-soon">Expires soon</option>
        </select>
      </div>

      {squads.length === 0 ? (
        <div className="card p-8 text-center text-muted">
          No Recruiting Squads match these filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {squads.map((squad) => (
            <SquadCard key={squad.id} squad={squad} game={games.get(squad.gameId)} />
          ))}
        </div>
      )}
    </div>
  )
}
