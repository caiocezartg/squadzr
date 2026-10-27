import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'

interface CreateSquadFooterProps {
  first: boolean
  last: boolean
  /** Whether "Continue" is allowed: step 1 needs a game. */
  canContinue: boolean
  creating: boolean
  onCancel: () => void
  onBack: () => void
}

/** The wizard's actions, pinned to the bottom of the dialog. "Continue" submits the form. */
export function CreateSquadFooter({
  first,
  last,
  canContinue,
  creating,
  onCancel,
  onBack,
}: CreateSquadFooterProps) {
  const t = useTranslations()

  return (
    <div className="bg-panel sticky bottom-0 mt-auto flex items-center justify-between gap-3 px-6 py-4">
      {first ? (
        <Button variant="ghost" onClick={onCancel}>
          {t('ds.createSquad.cancel')}
        </Button>
      ) : (
        <Button variant="ghost" icon={<ArrowLeft aria-hidden />} onClick={onBack}>
          {t('ds.createSquad.back')}
        </Button>
      )}
      {last ? (
        <Button
          type="submit"
          size="lg"
          disabled={creating}
          icon={creating ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />}
          iconPosition="end"
        >
          {creating ? t('squads.createModal.creating') : t('squads.createModal.submit')}
        </Button>
      ) : (
        <Button
          type="submit"
          size="lg"
          disabled={!canContinue}
          icon={<ArrowRight aria-hidden />}
          iconPosition="end"
        >
          {t('ds.createSquad.continue')}
        </Button>
      )}
    </div>
  )
}
