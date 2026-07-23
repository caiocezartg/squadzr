import { Link } from '@tanstack/react-router'
import { useSession, signIn, signOut } from '@/lib/auth-client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Menu } from 'lucide-react'
import { DiscordIcon } from '@/components/ui/icons'
import { NotificationsMenu } from '@/components/layout/notifications-menu'
import { UserMenu } from '@/components/layout/user-menu'
import { MobileSidebar } from '@/components/layout/mobile-sidebar'
import { useTranslation } from 'react-i18next'
import { LanguageToggle } from '@/components/layout/language-toggle'

export function AppHeader() {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const headerControlsRef = useRef<HTMLDivElement>(null)

  const closeMenus = useCallback(() => {
    setMenuOpen(false)
    setNotificationsOpen(false)
  }, [])

  useEffect(() => {
    if (!menuOpen && !notificationsOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (headerControlsRef.current && !headerControlsRef.current.contains(e.target as Node)) {
        closeMenus()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen, notificationsOpen, closeMenus])

  const handleSignOut = async () => {
    setMenuOpen(false)
    await signOut()
    window.location.href = '/'
  }

  const handleSignIn = () => {
    signIn.social({
      provider: 'discord',
      callbackURL: window.location.origin + '/rooms',
    })
  }

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:h-16 sm:px-6 lg:px-8">
          {/* Left: hamburger (mobile) + logo + nav (desktop) */}
          <div className="flex items-center gap-2 sm:gap-8">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex items-center justify-center rounded-lg p-1.5 text-muted hover:bg-surface-hover hover:text-offwhite transition-colors md:hidden"
              aria-label={t('nav.openMenu')}
            >
              <Menu className="size-5" />
            </button>

            <Link to="/" className="flex items-center gap-2 group">
              <img src="/squadzr-logo.svg" alt="Squadzr logo" className="hidden sm:block w-24" />
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <Link
                to="/squads"
                search={{}}
                activeOptions={{ exact: true }}
                className="rounded-lg border border-transparent px-3 py-2 text-sm font-medium transition-colors text-muted hover:bg-surface-hover hover:text-offwhite"
                activeProps={{ className: '!text-accent' }}
              >
                Squads
              </Link>
              <Link
                to="/rooms"
                search={{}}
                activeOptions={{ exact: true }}
                className="rounded-lg border border-transparent px-3 py-2 text-sm font-medium transition-colors text-muted hover:bg-surface-hover hover:text-offwhite"
                activeProps={{ className: '!text-accent' }}
              >
                {t('nav.allRooms')}
              </Link>
              {session?.user && (
                <Link
                  to="/rooms/my"
                  activeOptions={{ exact: true }}
                  className="rounded-lg border border-transparent px-3 py-2 text-sm font-medium transition-colors text-muted hover:bg-surface-hover hover:text-offwhite"
                  activeProps={{ className: '!text-accent' }}
                >
                  {t('nav.myRooms')}
                </Link>
              )}
            </nav>
          </div>

          {/* Right: controls */}
          <div ref={headerControlsRef} className="flex items-center gap-1.5 sm:gap-3">
            <LanguageToggle />
            {session?.user ? (
              <>
                <NotificationsMenu
                  enabled={!!session?.user}
                  isOpen={notificationsOpen}
                  onToggle={() => {
                    setNotificationsOpen((prev) => !prev)
                    setMenuOpen(false)
                  }}
                  onClose={() => setNotificationsOpen(false)}
                />

                <UserMenu
                  session={session}
                  menuOpen={menuOpen}
                  onToggle={() => {
                    setMenuOpen((prev) => !prev)
                    setNotificationsOpen(false)
                  }}
                  onSignOut={handleSignOut}
                />
              </>
            ) : (
              <button onClick={handleSignIn} className="btn-discord gap-2">
                <DiscordIcon className="size-4" />
                {t('common.signIn')}
              </button>
            )}
          </div>
        </div>
      </header>

      <MobileSidebar isOpen={sidebarOpen} onClose={closeSidebar} hasUser={!!session?.user} />
    </>
  )
}
