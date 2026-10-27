import { LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ds/button'

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
    <div className="bg-card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="bg-line text-ds-muted flex size-13 items-center justify-center">
        <LayoutGrid aria-hidden="true" className="size-5.5" strokeWidth={2.2} />
      </span>
      <h2 className="type-panel-title-sm text-text">{title}</h2>
      <p className="type-body text-text-3 max-w-sm">{description}</p>
      {action && (
        <Button className="mt-2" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
