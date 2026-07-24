import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface MobileSidebarProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly hasUser: boolean
}

export function MobileSidebar({ isOpen, onClose, hasUser }: MobileSidebarProps) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!isOpen) return

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar panel */}
      <div
        className={`fixed left-0 top-0 z-50 flex h-full w-64 flex-col bg-surface border-r border-border shadow-2xl shadow-black/50 transition-transform duration-300 ease-out md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pl-6 pr-4 py-4 border-b border-border">
          <Link to="/" className="flex items-center gap-2" onClick={onClose}>
            <img src="/squadzr-logo.svg" alt="Squadzr logo" className="w-20" />
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-hover hover:text-offwhite transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 p-3">
          <Link
            to="/squads"
            search={{}}
            activeOptions={{ exact: true }}
            className="rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-muted hover:bg-surface-hover hover:text-offwhite"
            activeProps={{ className: '!text-accent !bg-accent/[0.08]' }}
            onClick={onClose}
          >
            Squads
          </Link>
          <Link
            to="/rooms"
            search={{}}
            activeOptions={{ exact: true }}
            className="rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-muted hover:bg-surface-hover hover:text-offwhite"
            activeProps={{ className: '!text-accent !bg-accent/[0.08]' }}
            onClick={onClose}
          >
            {t('nav.allRooms')}
          </Link>
          {hasUser && (
            <Link
              to="/rooms/my"
              activeOptions={{ exact: true }}
              className="rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-muted hover:bg-surface-hover hover:text-offwhite"
              activeProps={{ className: '!text-accent !bg-accent/[0.08]' }}
              onClick={onClose}
            >
              {t('nav.myRooms')}
            </Link>
          )}
        </nav>
      </div>
    </>
  )
}
