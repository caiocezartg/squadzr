import { cn } from '@/lib/utils'

/** The current period's line in a legend: 2px of mint. */
export function CurrentSwatch({ className }: { readonly className?: string }) {
  return <i aria-hidden="true" className={cn('border-mint block w-3 border-t-2', className)} />
}

/** The previous period's line in a legend: 2px of dashed muted. */
export function PreviousSwatch({ className }: { readonly className?: string }) {
  return (
    <i
      aria-hidden="true"
      className={cn('border-muted block w-3 border-t-2 border-dashed', className)}
    />
  )
}
