import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import { AppLink } from '@/components/layout/app-link'
import { cn } from '@/lib/utils'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'link'
  | 'danger'
  | 'discord'
  | 'light'
  | 'dark'
  | 'glass'

export type ButtonSize = 'sm' | 'md' | 'lg'

/** The ground, text colour and hover of each variant (reference, Button). */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-mint text-mint-ink hover-fine:bg-mint-hover',
  secondary: 'bg-raised-2 text-text hover-fine:bg-track',
  ghost: 'bg-transparent text-text-2 hover-fine:bg-raised-2',
  link: 'bg-transparent text-mint hover-fine:text-[#7cffcf]',
  danger: 'bg-danger-ground text-ds-danger hover-fine:bg-danger-ground-hover',
  discord: 'bg-ds-discord text-white hover-fine:bg-discord-hover',
  light: 'bg-white text-[#2b33a8] hover-fine:shadow-[0_0_0_5px_rgba(255,255,255,0.18)]',
  dark: 'bg-bg text-text hover-fine:bg-raised-2',
  glass: 'bg-white/14 text-white hover-fine:bg-white/24',
}

/** The strong variants set the weight up to 800; the rest stay at 700. */
const HEAVY_VARIANTS: readonly ButtonVariant[] = ['primary', 'light', 'dark']

/** Quiet variants have no ground, so their disabled state has none either. */
const QUIET_VARIANTS: readonly ButtonVariant[] = ['ghost', 'link']

/** Disabled ground `track`, text `faint` (reference, Button). */
const DISABLED_CLASSES = 'bg-track text-faint'
const DISABLED_QUIET_CLASSES = 'bg-transparent text-faint'

interface SizeClasses {
  /** Height, gap, padding and text size. */
  readonly box: string
  readonly mono: string
  readonly icon: string
  /** The square an icon-only button takes. */
  readonly square: string
}

const SIZE_CLASSES: Record<ButtonSize, SizeClasses> = {
  sm: {
    box: 'min-h-9 gap-1.75 px-3 text-[12.5px]',
    mono: 'text-[11px]',
    icon: '[&_svg]:size-3.25',
    square: 'size-9',
  },
  md: {
    box: 'min-h-11 gap-2 px-4 text-sm',
    mono: 'text-[12.5px]',
    icon: '[&_svg]:size-3.75',
    square: 'size-11',
  },
  lg: {
    box: 'min-h-14 gap-2.5 px-6 text-base',
    mono: 'text-[14.5px]',
    icon: '[&_svg]:size-4.25',
    square: 'size-14',
  },
}

const BASE_CLASSES =
  'press inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap ' +
  'leading-[1.2] no-underline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-mint disabled:cursor-not-allowed aria-disabled:cursor-not-allowed'

interface ButtonOptions {
  /** @default 'primary' */
  readonly variant?: ButtonVariant
  /** @default 'md' */
  readonly size?: ButtonSize
  /** Drawn before the label, or after it with `iconPosition="end"`. It is decorative. */
  readonly icon?: ReactNode
  /** @default 'start' */
  readonly iconPosition?: 'start' | 'end'
  /** Squad codes and other mono text. */
  readonly mono?: boolean
  /** Fills the width of its container. */
  readonly full?: boolean
  readonly disabled?: boolean
  readonly className?: string
}

/**
 * A button either has a label or is an icon-only square. The square has no text of its own, so it
 * requires an accessible name.
 */
type ButtonContent =
  | { readonly children: ReactNode; readonly 'aria-label'?: string }
  | { readonly children?: undefined; readonly icon: ReactNode; readonly 'aria-label': string }

type ActionButtonProps = ButtonOptions &
  ButtonContent &
  Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'children' | 'className' | 'disabled' | 'aria-label'
  > & { readonly href?: undefined }

type LinkButtonProps = ButtonOptions &
  ButtonContent &
  Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'children' | 'className' | 'aria-label' | 'href'
  > & {
    readonly href: string
  }

export type ButtonProps = ActionButtonProps | LinkButtonProps

/**
 * The Redesign v2 button (reference, Components). It renders a link when it has an `href` and a
 * button otherwise. Hover applies to fine pointers only, and the press feedback comes from `press`.
 */
export function Button(props: ButtonProps) {
  return props.href === undefined ? <ActionButton {...props} /> : <LinkButton {...props} />
}

function ActionButton({
  variant,
  size,
  icon,
  iconPosition,
  mono,
  full,
  disabled,
  className,
  children,
  ...button
}: ActionButtonProps) {
  return (
    <button
      type="button"
      {...button}
      disabled={disabled}
      className={buttonClassName({
        variant,
        size,
        mono,
        full,
        disabled,
        iconOnly: children === undefined,
        className,
      })}
    >
      <ButtonFace icon={icon} iconPosition={iconPosition}>
        {children}
      </ButtonFace>
    </button>
  )
}

/**
 * A disabled link has no destination: it keeps its place in the layout, announces itself as
 * disabled and does nothing when clicked.
 */
function LinkButton({
  variant,
  size,
  icon,
  iconPosition,
  mono,
  full,
  disabled,
  className,
  children,
  href,
  ...anchor
}: LinkButtonProps) {
  const classes = buttonClassName({
    variant,
    size,
    mono,
    full,
    disabled,
    iconOnly: children === undefined,
    className,
  })
  const face = (
    <ButtonFace icon={icon} iconPosition={iconPosition}>
      {children}
    </ButtonFace>
  )

  if (disabled) {
    return (
      <a {...anchor} onClick={undefined} role="link" aria-disabled="true" className={classes}>
        {face}
      </a>
    )
  }
  if (isAppPath(href)) {
    return (
      <AppLink {...anchor} href={href} className={classes}>
        {face}
      </AppLink>
    )
  }
  return (
    <a {...anchor} href={href} className={classes}>
      {face}
    </a>
  )
}

/** A path inside the app. Anything else, such as a Discord invite, leaves it through a plain anchor. */
function isAppPath(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//')
}

function buttonClassName({
  variant = 'primary',
  size = 'md',
  mono = false,
  full = false,
  disabled = false,
  iconOnly,
  className,
}: Pick<ButtonOptions, 'variant' | 'size' | 'mono' | 'full' | 'disabled' | 'className'> & {
  readonly iconOnly: boolean
}): string {
  const sizeClasses = SIZE_CLASSES[size]

  return cn(
    BASE_CLASSES,
    sizeClasses.box,
    sizeClasses.icon,
    mono ? ['font-ds-mono tracking-widest', sizeClasses.mono] : 'font-body',
    HEAVY_VARIANTS.includes(variant) ? 'font-extrabold' : 'font-bold',
    disabled
      ? QUIET_VARIANTS.includes(variant)
        ? DISABLED_QUIET_CLASSES
        : DISABLED_CLASSES
      : VARIANT_CLASSES[variant],
    variant === 'link' && 'px-1.5',
    iconOnly && [sizeClasses.square, 'p-0'],
    full && 'w-full',
    className
  )
}

function ButtonFace({
  icon,
  iconPosition = 'start',
  children,
}: {
  readonly icon: ReactNode
  readonly iconPosition?: 'start' | 'end'
  readonly children: ReactNode
}) {
  const iconNode = icon ? (
    <span aria-hidden="true" className="inline-flex shrink-0 [&_svg]:stroke-[2.6]">
      {icon}
    </span>
  ) : null

  return (
    <>
      {iconPosition === 'start' && iconNode}
      {children !== undefined && <span className="contents">{children}</span>}
      {iconPosition === 'end' && iconNode}
    </>
  )
}
