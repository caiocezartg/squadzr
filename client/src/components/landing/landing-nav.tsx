'use client'

import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Menu, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { LanguageToggle } from '@/components/layout/language-toggle'
import { cn } from '@/lib/utils'
import { LandingNavAuth } from './landing-nav-auth'
import { LandingNavLinks } from './landing-nav-links'

/**
 * The landing's own top navigation (the landing has no sidebar): the logo, the in-page links, the
 * language switch and the account action. Below 640px the links and actions collapse into a menu.
 * The same elements serve both widths and CSS lays them out, so the server HTML is the same at
 * every width.
 */
export function LandingNav() {
  const t = useTranslations('ds.shell')
  const [open, setOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)

  const close = () => {
    setOpen(false)
    menuButton.current?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && open) close()
  }

  // A link followed from the open menu closes it, so the page it scrolls to is not left behind it.
  const handlePanelClick = (event: MouseEvent<HTMLElement>) => {
    if (open && event.target instanceof Element && event.target.closest('a')) close()
  }

  return (
    <header
      onKeyDown={handleKeyDown}
      className="relative z-10 mx-auto flex max-w-310 flex-wrap items-center gap-x-10 gap-y-4 px-4 py-5.5 sm:px-6"
    >
      <a
        href="#topo"
        aria-label={t('home')}
        className="focus-visible:outline-mint block shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        <img src="/squadzr-logo.svg" alt="" className="block w-26" />
      </a>

      <button
        ref={menuButton}
        type="button"
        aria-expanded={open}
        aria-controls="landing-nav-panel"
        aria-label={open ? t('closeMenu') : t('openMenu')}
        onClick={() => {
          setOpen((current) => !current)
        }}
        className="press bg-card text-text hover-fine:bg-raised-2 focus-visible:outline-mint ml-auto flex size-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 sm:hidden"
      >
        {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
      </button>

      <div
        id="landing-nav-panel"
        onClick={handlePanelClick}
        className={cn(
          'sm:contents',
          'max-sm:bg-panel max-sm:basis-full max-sm:flex-col max-sm:gap-4 max-sm:p-4',
          open ? 'max-sm:animate-menu-in max-sm:flex' : 'max-sm:hidden'
        )}
      >
        <div className="sm:mr-auto">
          <LandingNavLinks />
        </div>
        <div className="flex flex-wrap items-center gap-3 max-sm:flex-col max-sm:items-stretch sm:ml-auto">
          <div className="max-sm:self-start">
            <LanguageToggle fluid={false} />
          </div>
          <LandingNavAuth />
        </div>
      </div>
    </header>
  )
}
