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
    if (visible.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id)
            break
          }
        }
      },
      { rootMargin: '-72px 0px -60% 0px', threshold: 0 }
    )

    visible.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [visible])

  if (visible.length === 0) return null

  return (
    <div className="sticky top-24">
      <div className="text-[9px] uppercase tracking-[0.22em] text-tg-fg-faint mb-3 px-3 font-mono">
        On this page
      </div>

      <nav className="space-y-px">
        {visible.map((h) => (
          <a
            key={h.id}
            href={`#${h.id}`}
            className={cn(
              'block text-[11px] py-1 px-3 rounded-sm transition-all duration-150 font-mono leading-relaxed',
              h.level === 3 ? 'pl-6' : '',
              h.level === 2 ? '' : '',
              active === h.id
                ? 'text-amber-400 border-l border-amber-400 bg-amber-400/5'
                : 'text-tg-fg-faint hover:text-tg-fg-dim border-l border-transparent'
            )}
          >
            {h.text}
          </a>
        ))}
      </nav>
    </div>
  )
}
