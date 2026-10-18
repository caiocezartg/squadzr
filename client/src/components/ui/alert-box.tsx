import { XCircle, CheckCircle, AlertTriangle, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface AlertBoxProps {
  type: 'error' | 'success' | 'warning'
  message: string
  onClose?: () => void
}

const styles = {
  error: 'border-danger/30 bg-danger/5 text-danger',
  success: 'border-accent/30 bg-accent/5 text-accent',
  warning: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400',
}

const icons = {
  error: <XCircle className="size-4 shrink-0" />,
  success: <CheckCircle className="size-4 shrink-0" />,
  warning: <AlertTriangle className="size-4 shrink-0" />,
}

export function AlertBox({ type, message, onClose }: AlertBoxProps) {
  const t = useTranslations()
  return (
    <div className={`flex items-center gap-3 border rounded-xl px-4 py-3 text-sm ${styles[type]}`}>
      {icons[type]}
      <span className="flex-1">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          aria-label={t('common.close')}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}
