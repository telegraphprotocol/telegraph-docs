'use client'

import { useEffect, useState } from 'react'
import type { DocHeading } from '@/lib/docs'
import { cn } from '@/lib/utils'

interface TOCProps {
  headings: DocHeading[]
}

export function TOC({ headings }: TOCProps) {
  const [active, setActive] = useState<string>('')
  const visible = headings.filter((h) => h.level <= 3)

  useEffect(() => {
    if (!visible.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) { setActive(entry.target.id); break }
        }
      },
      { rootMargin: '-64px 0px -60% 0px', threshold: 0 }
    )
    visible.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [visible])

  if (!visible.length) return null

  return (
    <div className="sticky top-20">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--tg-fg-faint)]">
        On this page
      </p>
      <nav className="space-y-px">
        {visible.map((h) => (
          <a
            key={h.id}
            href={`#${h.id}`}
            className={cn(
              'block py-1 text-[13px] leading-snug transition-colors duration-100',
              h.level === 3 ? 'pl-4 text-[12.5px]' : 'pl-0',
              active === h.id
                ? 'text-amber-600 dark:text-amber-400 font-medium'
                : 'text-[var(--tg-fg-faint)] hover:text-[var(--tg-fg-dim)]'
            )}
          >
            {h.text}
          </a>
        ))}
      </nav>
    </div>
  )
}
