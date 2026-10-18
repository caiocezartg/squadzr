import { ChevronDown, LogOut } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface UserMenuProps {
  readonly session: {
    user: { name?: string | null; email?: string | null; image?: string | null }
  }
  readonly menuOpen: boolean
  readonly onToggle: () => void
  readonly onSignOut: () => void
}

export function UserMenu({ session, menuOpen, onToggle, onSignOut }: UserMenuProps) {
  const t = useTranslations()

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-hover transition-colors"
      >
        {session.user.image ? (
          <img src={session.user.image} alt="" className="size-7 rounded-full ring-1 ring-border" />
        ) : (
          <div className="size-7 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
            {session.user.name?.charAt(0)?.toUpperCase()}
          </div>
        )}
        <span className="hidden sm:block text-sm font-medium text-offwhite">
          {session.user.name}
        </span>
        <ChevronDown className="size-4 text-muted hidden sm:block" />
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-xl border border-border bg-surface p-1 shadow-2xl shadow-black/50">
          <div className="px-3 py-2 border-b border-border mb-1">
            <p className="text-xs text-muted truncate">{session.user.email}</p>
          </div>
          <button
            onClick={onSignOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:text-offwhite hover:bg-surface-hover transition-colors"
          >
            <LogOut className="size-4" />
            {t('common.signOut')}
          </button>
        </div>
      )}
    </div>
  )
}
