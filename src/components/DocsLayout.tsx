'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PanelLeft, PanelLeftClose } from 'lucide-react'
import { Navbar }         from './Navbar'
import { Sidebar }        from './Sidebar'
import { TOC }            from './TOC'
import { ScrollProgress } from './ScrollProgress'
import { SearchModal }    from './SearchModal'
import { Breadcrumb }      from './Breadcrumb'
import { AppBackground }   from './AppBackground'
import { BackToTop }       from './BackToTop'
import type { NavSection, DocHeading } from '@/lib/docs'
import { cn } from '@/lib/utils'

interface DocsLayoutProps {
  nav:      NavSection[]
  slug:     string[]
  headings: DocHeading[]
  prevHref: string | null
  nextHref: string | null
  children: React.ReactNode
}

export function DocsLayout({
  nav, slug, headings, prevHref, nextHref, children,
}: DocsLayoutProps) {
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [searchOpen,  setSearchOpen]  = useState(false)
  const [showLegacy,  setShowLegacy]  = useState(false)
  const router = useRouter()

  // Open sidebar by default on desktop, keep closed on mobile
  useEffect(() => {
    if (window.innerWidth >= 1024) setMenuOpen(true)
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA'

      // ⌘K / Ctrl+K → open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        return
      }
      // / → open search (not in input)
      if (e.key === '/' && !inInput) {
        e.preventDefault()
        setSearchOpen(true)
        return
      }
      // ← / → for prev/next page (not in input, no modifier)
      if (!inInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === 'ArrowLeft'  && prevHref) router.push(prevHref)
        if (e.key === 'ArrowRight' && nextHref) router.push(nextHref)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [prevHref, nextHref, router])

  return (
    <div className="min-h-screen bg-[var(--tg-bg)] font-sans">
      <AppBackground />
      {/* Amber scroll progress bar */}
      <ScrollProgress />

      {/* Top nav */}
      <Navbar
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen((v) => !v)}
        onSearchOpen={() => setSearchOpen(true)}
      />

      {/* Sidebar */}
      <Sidebar nav={nav} isOpen={menuOpen} onClose={() => setMenuOpen(false)} showLegacy={showLegacy} onLegacyToggle={setShowLegacy} />

      {/* Search modal */}
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} showLegacy={showLegacy} />}


      {/* Page body */}
      <div className={cn('pt-16 transition-[padding] duration-200 ease-out', menuOpen && 'lg:pl-[272px]')}>
        <div className="flex min-h-[calc(100vh-64px)]">

          {/* Main content */}
          <main className="flex-1 min-w-0 py-10 px-5 sm:px-8 lg:px-14">
            <div className="w-full lg:w-2/3">
              {/* Breadcrumb row with sidebar toggle */}
              <div className="flex items-center gap-1.5 mb-6">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className={cn(
                    'hidden lg:flex flex-shrink-0 items-center justify-center w-6 h-6 rounded transition-colors duration-150',
                    'text-[var(--tg-fg)] hover:text-white hover:bg-[var(--tg-line-soft)]',
                  )}
                  aria-label="Toggle sidebar"
                >
                  {menuOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
                </button>
                <Breadcrumb nav={nav} slug={slug} />
              </div>

              {children}

              {/* Bottom rule */}
              <div className="mt-16 pt-8 border-t border-[var(--tg-line)]">
                <div className="flex items-center gap-1.5">
                  <div className="h-px flex-1 bg-gradient-to-r from-amber-500/20 to-transparent" />
                  <span className="text-[10px] text-[var(--tg-fg-faint)] uppercase tracking-[0.15em] font-brand">
                    telegraph protocol
                  </span>
                </div>
              </div>
            </div>
          </main>

          {/* TOC (right rail, xl+) */}
          {headings.length > 1 && (
            <aside className="hidden xl:block w-72 flex-shrink-0 py-10 pr-6 pl-5">
              <TOC headings={headings} />
            </aside>
          )}
          <BackToTop />
        </div>
      </div>
    </div>
  )
}
