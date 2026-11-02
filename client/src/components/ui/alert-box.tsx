import { XCircle, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface AlertBoxProps {
  message: string
  onClose?: () => void
}

/** An inline error line on the danger ground, with an optional close button. */
export function AlertBox({ message, onClose }: AlertBoxProps) {
  const t = useTranslations()
  return (
    <div className="bg-danger-ground text-danger flex items-center gap-3 px-4 py-3 text-sm font-semibold">
      <XCircle aria-hidden="true" className="size-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="press flex size-8 shrink-0 items-center justify-center opacity-70 hover-fine:opacity-100"
          aria-label={t('common.close')}
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  )
}
