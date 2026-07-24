import { Link } from '@tanstack/react-router'
import { Clock3, Users } from 'lucide-react'
import type { Game, PublicRecruitingSquad } from '@squadzr/types'

interface SquadCardProps {
  readonly squad: PublicRecruitingSquad
  readonly game?: Game
}

function formatExpiration(expiresAt: Date): string {
  const remainingMinutes = Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60_000)
  )
  return remainingMinutes < 60
    ? `${remainingMinutes}m remaining`
    : `${Math.ceil(remainingMinutes / 60)}h remaining`
}

export function SquadCard({ squad, game }: SquadCardProps) {
  return (
    <Link
      to="/squads/$code"
      params={{ code: squad.code }}
      className="group overflow-hidden rounded-xl border border-border bg-surface transition-all hover:-translate-y-0.5 hover:border-accent/25 hover:shadow-[0_6px_32px_rgba(0,255,162,0.07)]"
    >
      {game?.coverUrl && (
        <div className="h-32 overflow-hidden bg-surface-light">
          <img
            src={game.coverUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>
      )}
      <div className="flex flex-col gap-3 p-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h2 className="truncate font-heading text-base font-bold text-offwhite">
              {squad.name}
            </h2>
            <span className="font-mono text-xs text-muted">#{squad.code}</span>
          </div>
          <p className="mt-1 text-sm text-muted">{game?.name ?? 'Unknown game'}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="badge-muted px-1.5 py-0.5 text-[10px]">
            {squad.language === 'pt-br' ? 'PT-BR' : 'EN-US'}
          </span>
          {squad.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-accent/20 bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent"
            >
              #{tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5" />
            <strong className="font-medium text-offwhite">{squad.memberCount}</strong>/
            {squad.maxMembers}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock3 className="size-3.5" />
            {formatExpiration(squad.expiresAt)}
          </span>
        </div>
      </div>
    </Link>
  )
}
