import { cn } from '@/lib/utils'

/**
 * Each dot starts 0.15s after the one before it. The delay is an inline style: the `animate-*` utility
 * sets the `animation` shorthand, which would reset a delay given as a class.
 */
const DOT_DELAYS_MS = [0, 150, 300]

/**
 * Three small mint dots that bob in turn: someone is typing. They are decoration only, so the parent says
 * in words who is typing. Under reduced motion they stay still.
 */
export function TypingDots({ className }: { readonly className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-testid="typing-dots"
      className={cn('inline-flex shrink-0 items-center gap-0.75', className)}
    >
      {DOT_DELAYS_MS.map((delay) => (
        <span
          key={delay}
          style={{ animationDelay: `${delay}ms` }}
          className="bg-mint motion-safe:animate-typing-dot size-1.25 rounded-full"
        />
      ))}
    </span>
  )
}
