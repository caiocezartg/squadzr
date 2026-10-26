import { Globe, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

type StaticTagVariant = 'tag' | 'glass' | 'lang' | 'lang-light'

interface StaticTagProps {
  /** The read-only chips: a `#label`, its glass twin, and the Squad language with a globe. */
  readonly variant?: StaticTagVariant
  /** @default 'sm' */
  readonly size?: 'sm' | 'md'
  /** Without the `#`: the `tag` and `glass` variants add it. */
  readonly label: string
}

interface ToggleTagProps {
  readonly variant: 'toggle'
  readonly label: string
  readonly pressed: boolean
  readonly onClick: () => void
}

interface SuggestTagProps {
  readonly variant: 'suggest'
  readonly label: string
  readonly onClick: () => void
}

interface RemovableTagProps {
  readonly variant: 'removable'
  readonly label: string
  readonly onClick: () => void
}

export type TagProps = StaticTagProps | ToggleTagProps | SuggestTagProps | RemovableTagProps

interface StaticTagStyle {
  readonly classes: string
  readonly hashed: boolean
}

const STATIC_STYLES: Record<StaticTagVariant, StaticTagStyle> = {
  tag: { classes: 'bg-raised-2 text-text-2 font-semibold', hashed: true },
  glass: { classes: 'bg-white/8 text-text-2 font-semibold', hashed: true },
  lang: { classes: 'bg-line text-text font-bold', hashed: false },
  'lang-light': { classes: 'bg-text text-bg font-bold', hashed: false },
}

const STATIC_SIZES = {
  sm: { text: 'text-xs', tag: 'px-2.25 py-1', lang: 'px-2 py-0.75', globe: 'size-2.75' },
  md: {
    text: 'text-[13px]',
    tag: 'px-2.5 py-1.25',
    lang: 'px-2.5 py-1.25',
    globe: 'size-3.25',
  },
} as const

/**
 * The chip's hit area reaches 44px even where the chip itself is 30 to 34px tall (reference,
 * Spacing and layout), without changing the layout.
 */
const BUTTON_BASE =
  'press relative inline-flex items-center gap-1.75 whitespace-nowrap font-bold ' +
  'after:absolute after:inset-x-0 after:-inset-y-2 after:content-[""] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint'

/**
 * The Redesign v2 tag (reference, Components). `tag`, `glass`, `lang` and `lang-light` are
 * read-only text; `toggle`, `suggest` and `removable` are buttons.
 */
export function Tag(props: TagProps) {
  switch (props.variant) {
    case 'toggle':
      return <ToggleTag {...props} />
    case 'suggest':
      return <SuggestTag {...props} />
    case 'removable':
      return <RemovableTag {...props} />
    default:
      return <StaticTag {...props} />
  }
}

function StaticTag({ variant = 'tag', size = 'sm', label }: StaticTagProps) {
  const style = STATIC_STYLES[variant]
  const sizes = STATIC_SIZES[size]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.25 whitespace-nowrap leading-[1.3]',
        style.classes,
        sizes.text,
        style.hashed ? sizes.tag : sizes.lang
      )}
    >
      {!style.hashed && <Globe aria-hidden="true" className={cn('shrink-0', sizes.globe)} />}
      {style.hashed ? `#${label}` : label}
    </span>
  )
}

function ToggleTag({ label, pressed, onClick }: ToggleTagProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        BUTTON_BASE,
        'min-h-8 px-2.75 text-xs',
        pressed
          ? 'bg-mint text-mint-ink hover-fine:bg-mint-hover'
          : 'bg-mint/8 text-mint hover-fine:bg-mint/16'
      )}
    >
      #{label}
    </button>
  )
}

function SuggestTag({ label, onClick }: SuggestTagProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        BUTTON_BASE,
        'min-h-7.5 bg-mint/8 px-2.5 text-xs text-mint hover-fine:bg-mint/16'
      )}
    >
      + #{label}
    </button>
  )
}

function RemovableTag({ label, onClick }: RemovableTagProps) {
  const t = useTranslations('ds.tag')

  return (
    <button
      type="button"
      aria-label={t('remove', { label })}
      onClick={onClick}
      className={cn(
        BUTTON_BASE,
        'min-h-8.5 bg-line pr-2.25 pl-2.75 text-[12.5px] text-text hover-fine:bg-[#2a2b31]'
      )}
    >
      {label}
      <X aria-hidden="true" className="size-2.75 shrink-0 text-text-3 stroke-[2.8]" />
    </button>
  )
}
