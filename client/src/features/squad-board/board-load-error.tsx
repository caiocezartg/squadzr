import { TriangleAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'

/** The board's inline error: what failed, and a button that reads the list again. */
export function BoardLoadError({ onRetry }: { readonly onRetry: () => void }) {
  const t = useTranslations('squads.page')

  return (
    <div className="flex flex-col items-start gap-3">
      <div
        role="alert"
        className="bg-danger-ground text-ds-danger flex w-full items-center gap-3 px-4 py-3.5 text-sm font-semibold"
      >
        <TriangleAlert aria-hidden="true" className="size-4.5 shrink-0" strokeWidth={2.4} />
        {t('loadError')}
      </div>
      <Button variant="secondary" onClick={onRetry}>
        {t('retry')}
      </Button>
    </div>
  )
}
