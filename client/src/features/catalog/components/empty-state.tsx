import { LayoutGrid } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="size-16 rounded-2xl bg-surface-light border border-border flex items-center justify-center mb-4">
        <LayoutGrid className="size-7 text-muted" strokeWidth={1.5} />
      </div>
      <h3 className="font-heading text-lg font-bold text-offwhite">{title}</h3>
      <p className="mt-1 text-sm text-muted max-w-sm">{description}</p>
      {action && (
        <button onClick={action.onClick} className="btn-accent mt-4">
          {action.label}
        </button>
      )}
    </div>
  )
}
