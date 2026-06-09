'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar }         from './Navbar'
import { Sidebar }        from './Sidebar'
import { TOC }            from './TOC'
import { ScrollProgress } from './ScrollProgress'
import { SearchModal }    from './SearchModal'
import type { NavSection, DocHeading } from '@/lib/docs'

interface DocsLayoutProps {
  nav:      NavSection[]
  slug:     string[]
  headings: DocHeading[]
  prevHref: string | null
  nextHref: string | null
  children: React.ReactNode
}

export function DocsLayout({
  nav, slug: _slug, headings, prevHref, nextHref, children,
}: DocsLayoutProps) {
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const router = useRouter()

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
    <div className="min-h-screen bg-black font-mono">
      {/* Amber scroll progress bar */}
      <ScrollProgress />

      {/* Top nav */}
      <Navbar
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen((v) => !v)}
        onSearchOpen={() => setSearchOpen(true)}
      />

      {/* Sidebar */}
      <Sidebar nav={nav} isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Search modal */}
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}

      {/* Page body */}
      <div className="pt-[72px] lg:pl-[280px]">
        <div className="flex min-h-[calc(100vh-72px)]">

          {/* Main content */}
          <main className="flex-1 min-w-0 py-10 px-5 sm:px-8 lg:px-14">
            <div className="w-full lg:w-2/3">
              {children}

              {/* Bottom rule */}
              <div className="mt-16 pt-8 border-t border-tg-line">
                <div className="flex items-center gap-1.5">
                  <div className="h-px flex-1 bg-gradient-to-r from-amber-500/20 to-transparent" />
                  <span className="text-[9px] text-tg-fg-faint uppercase tracking-[0.2em] font-mono">
                    telegraph protocol
                  </span>
                </div>
              </div>
            </div>
          </main>

          {/* TOC (right rail, xl+) */}
          {headings.length > 1 && (
            <aside className="hidden xl:block w-60 flex-shrink-0 py-10 pr-8 pl-2">
              <TOC headings={headings} />
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
