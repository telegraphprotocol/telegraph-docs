'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import type { NavSection, NavItem } from '@/lib/docs'
import { cn } from '@/lib/utils'

// ── Single nav item (recursive) ───────────────────────────────────────────────
function NavItemRow({
  item,
  depth = 0,
  onNavigate,
}: {
  item: NavItem
  depth?: number
  onNavigate: () => void
}) {
  const pathname = usePathname()
  const isActive  = pathname === item.href
  const hasChildren = !!(item.children && item.children.length > 0)

  // Auto-open if a child is active
  const childIsActive = (items: NavItem[]): boolean =>
    items.some(
      (c) => pathname === c.href || (c.children ? childIsActive(c.children) : false)
    )

  const [open, setOpen] = useState<boolean>(
    () => isActive || (hasChildren ? childIsActive(item.children!) : false)
  )

  // Re-evaluate on pathname change
  useEffect(() => {
    if (hasChildren && childIsActive(item.children!)) setOpen(true)
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className={cn('flex items-center', depth > 0 && 'pl-3')}>
        <Link
          href={item.href}
          onClick={onNavigate}
          className={cn(
            'flex-1 py-[5px] px-3 text-[12.5px] leading-snug rounded-sm transition-all duration-100 font-mono',
            'border-l-2',
            isActive
              ? 'text-amber-400 border-amber-400 bg-amber-400/[0.06] font-medium'
              : 'text-tg-fg-dim border-transparent hover:text-tg-fg hover:bg-white/[0.03]'
          )}
        >
          {item.title}
        </Link>

        {hasChildren && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex-shrink-0 p-1 text-tg-fg-faint hover:text-tg-fg-dim transition-colors"
            aria-label="Toggle section"
          >
            <ChevronRight
              size={11}
              className={cn('transition-transform duration-150', open && 'rotate-90')}
            />
          </button>
        )}
      </div>

      {hasChildren && open && (
        <div className="ml-1 border-l border-tg-line-soft mt-0.5 mb-0.5">
          {item.children!.map((child) => (
            <NavItemRow
              key={child.href}
              item={child}
              depth={depth + 1}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sidebar component ─────────────────────────────────────────────────────────
interface SidebarProps {
  nav: NavSection[]
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ nav, isOpen, onClose }: SidebarProps) {
  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity duration-200',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed top-[72px] left-0 bottom-0 z-50 w-[280px]',
          'bg-black border-r border-tg-line',
          'overflow-y-auto overscroll-contain',
          'transition-transform duration-200 ease-out',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Top decorative rail */}
        <div className="h-px bg-gradient-to-r from-amber-500/30 via-amber-500/10 to-transparent mx-4 mt-4 mb-5" />

        <nav className="pb-8 px-3">
          {nav.map((section) => (
            <div key={section.title} className="mb-5">
              {/* Section label */}
              <div className="flex items-center gap-2 px-3 mb-1.5">
                <div className="w-3 h-px bg-amber-500/50" />
                <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-500/70 font-mono">
                  {section.title}
                </span>
              </div>

              <div className="space-y-px">
                {section.items.map((item) => (
                  <NavItemRow key={item.href} item={item} onNavigate={onClose} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom tag */}
        <div className="px-6 py-4 border-t border-tg-line">
          <div className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] text-tg-fg-faint font-mono uppercase tracking-[0.15em]">
              telegraph protocol
            </span>
          </div>
        </div>
      </aside>
    </>
  )
}
