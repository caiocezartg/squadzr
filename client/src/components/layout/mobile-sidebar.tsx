import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AppLink } from '@/components/layout/app-link'

interface MobileSidebarProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly hasUser: boolean
}

export function MobileSidebar({ isOpen, onClose, hasUser }: MobileSidebarProps) {
  const t = useTranslations()
  const pathname = usePathname()

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
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-300 md:hidden ${
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
          <AppLink href="/" className="flex items-center gap-2" onClick={onClose}>
            <img src="/squadzr-logo.svg" alt="Squadzr logo" className="w-20" />
          </AppLink>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-hover hover:text-offwhite transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 p-3">
          <AppLink
            href="/rooms"
            className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-muted hover:bg-surface-hover hover:text-offwhite ${
              pathname === '/rooms' ? 'text-accent! bg-accent/8!' : ''
            }`}
            onClick={onClose}
          >
            {t('nav.allSquads')}
          </AppLink>
          {hasUser && (
            <AppLink
              href="/rooms/my"
              className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-muted hover:bg-surface-hover hover:text-offwhite ${
                pathname === '/rooms/my' ? 'text-accent! bg-accent/8!' : ''
              }`}
              onClick={onClose}
            >
              {t('nav.mySquads')}
            </AppLink>
          )}
        </nav>
      </div>
    </>
  )
}
