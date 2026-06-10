'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import type { NavSection, NavItem } from '@/lib/docs'
import { cn } from '@/lib/utils'

// ── Single nav item ───────────────────────────────────────────────────────────
function NavItemRow({
  item,
  depth = 0,
  onNavigate,
}: {
  item: NavItem
  depth?: number
  onNavigate: () => void
}) {
  const pathname    = usePathname()
  const isActive    = pathname === item.href
  const hasChildren = !!(item.children?.length)

  const childIsActive = (items: NavItem[]): boolean =>
    items.some((c) => pathname === c.href || (c.children ? childIsActive(c.children) : false))

  const [open, setOpen] = useState(
    () => isActive || (hasChildren ? childIsActive(item.children!) : false)
  )

  useEffect(() => {
    if (hasChildren && childIsActive(item.children!)) setOpen(true)
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className={cn('flex items-center gap-0.5', depth > 0 && 'pl-3')}>
        <Link
          href={item.href}
          onClick={onNavigate}
          className={cn(
            'flex-1 py-[5px] px-2.5 rounded-md text-[13.5px] leading-snug transition-all duration-100',
            isActive
              ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/[0.08] font-medium'
              : 'text-[var(--tg-fg-dim)] hover:text-[var(--tg-fg)] hover:bg-[var(--tg-line-soft)]'
          )}
        >
          {item.title}
        </Link>
        {hasChildren && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex-shrink-0 p-1 text-[var(--tg-fg-faint)] hover:text-[var(--tg-fg-dim)] rounded transition-colors"
          >
            <ChevronRight
              size={12}
              className={cn('transition-transform duration-150', open && 'rotate-90')}
            />
          </button>
        )}
      </div>

      {hasChildren && open && (
        <div className="ml-3 border-l border-[var(--tg-line)] my-0.5">
          {item.children!.map((child) => (
            <NavItemRow key={child.href} item={child} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
interface SidebarProps {
  nav: NavSection[]
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ nav, isOpen, onClose }: SidebarProps) {
  const handleNavigate = () => {
    if (window.innerWidth < 1024) onClose()
  }

  useEffect(() => {
    const isMobile = window.innerWidth < 1024
    document.body.style.overflow = (isOpen && isMobile) ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity duration-200',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className={cn(
          'fixed top-[64px] left-0 bottom-0 z-50 w-[272px]',
          'bg-[var(--tg-sidebar)] border-r border-[var(--tg-line)]',
          'overflow-y-auto overscroll-contain',
          'transition-transform duration-200 ease-out',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <nav className="py-5 px-3">
          {/* Search hint */}
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
            className="w-full flex items-center justify-between gap-2 mb-5 px-2.5 py-2 rounded-md border border-[var(--tg-line)] hover:border-[var(--tg-line-strong)] bg-[var(--tg-bg)] hover:bg-[var(--tg-line-soft)] text-[var(--tg-fg-faint)] hover:text-[var(--tg-fg-dim)] transition-all duration-150"
          >
            <span className="text-[12px]">Search docs...</span>
            <kbd className="flex items-center gap-0.5 text-[10px] font-brand border border-[var(--tg-line)] rounded px-1.5 py-0.5 bg-[var(--tg-bg-subtle)]">⌘K</kbd>
          </button>

          {nav.map((section, si) => (
            <div key={section.title} className={cn('mb-4', si > 0 && 'mt-5')}>
              {/* Section label */}
              <p className="px-2.5 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--tg-fg-faint)] font-brand select-none">
                {section.title}
              </p>
              <div className="space-y-px">
                {section.items.map((item) => (
                  <NavItemRow key={item.href} item={item} onNavigate={handleNavigate} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
