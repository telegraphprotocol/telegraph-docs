'use client'

import { useEffect, useRef, useState } from 'react'
import type { DocHeading } from '@/lib/docs'
import { cn } from '@/lib/utils'

interface TOCProps {
  headings: DocHeading[]
}

export function TOC({ headings }: TOCProps) {
  const [activeId, setActiveId] = useState<string>('')
  const itemRefs  = useRef<Record<string, HTMLAnchorElement | null>>({})
  const visible   = headings.filter((h) => h.level <= 3)

  useEffect(() => {
    if (!visible.length) return

    const headingEls = visible
      .map(({ id }) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[]

    const onScroll = () => {
      // Find the last heading whose top is above the middle of the viewport
      const mid = window.scrollY + window.innerHeight * 0.25 + 64
      let current = headingEls[0]?.id ?? ''
      for (const el of headingEls) {
        if (el.offsetTop <= mid) current = el.id
        else break
      }
      setActiveId(current)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll() // set on mount
    return () => window.removeEventListener('scroll', onScroll)
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll the active TOC item into view within the TOC container
  useEffect(() => {
    itemRefs.current[activeId]?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  if (!visible.length) return null

  return (
    <div className="sticky top-20 max-h-[calc(100vh-88px)] flex flex-col">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--tg-fg-faint)] flex-shrink-0">
        On this page
      </p>
      <nav className="overflow-y-auto overscroll-contain space-y-px pr-1">
        {visible.map((h) => {
          const isActive = activeId === h.id
          return (
            <a
              key={h.id}
              href={`#${h.id}`}
              ref={(el) => { itemRefs.current[h.id] = el }}
              className={cn(
                'group relative flex items-start py-1 text-[13px] leading-snug transition-all duration-150',
                'border-l-2',
                h.level === 3 ? 'pl-5' : 'pl-3',
                isActive
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-medium'
                  : 'border-transparent text-[var(--tg-fg-faint)] hover:text-[var(--tg-fg-dim)] hover:border-[var(--tg-line-strong)]'
              )}
            >
              {h.text}
            </a>
          )
        })}
      </nav>
    </div>
  )
}
