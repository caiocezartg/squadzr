import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AlertBox } from '@/components/ui/alert-box'
import type { PublicRecruitingSquad } from '@squadzr/types'

type SquadResponse = { squad: PublicRecruitingSquad }

export const Route = createFileRoute('/squads/$code')({ component: PublicSquadPage })

function PublicSquadPage() {
  const { code } = Route.useParams()
  const squadQuery = useQuery({
    queryKey: ['squads', 'recruiting', code],
    queryFn: () => api.get<SquadResponse>(`/api/squads/${code}`),
  })

  if (squadQuery.isLoading)
    return <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-muted">Loading Squad…</div>
  if (squadQuery.isError || !squadQuery.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <AlertBox type="error" message="This Recruiting Squad is no longer available." />
      </div>
    )
  }

  const { squad } = squadQuery.data
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="card p-6 sm:p-8">
        <p className="font-mono text-sm text-muted">#{squad.code}</p>
        <h1 className="mt-2 font-heading text-3xl font-bold">{squad.name}</h1>
        <p className="mt-4 text-muted">
          {squad.memberCount} of {squad.maxMembers} Memberships filled ·{' '}
          {squad.language === 'pt-br' ? 'PT-BR' : 'EN-US'}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {squad.tags.map((tag) => (
            <span key={tag} className="badge-muted">
              #{tag}
            </span>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted">
          Recruiting ends {new Date(squad.expiresAt).toLocaleString()}.
        </p>
      </div>
    </div>
  )
}
