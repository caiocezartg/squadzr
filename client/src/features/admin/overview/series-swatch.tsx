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

/** The chart's band over days with no data in a legend: a patch of its diagonal hatch. */
export function NoDataSwatch({ className }: { readonly className?: string }) {
  return (
    <i
      aria-hidden="true"
      className={cn(
        'border-track block h-2.5 w-3 rounded-[2px] border bg-[repeating-linear-gradient(135deg,var(--color-track)_0_1.5px,transparent_1.5px_4px)]',
        className
      )}
    />
  )
}
