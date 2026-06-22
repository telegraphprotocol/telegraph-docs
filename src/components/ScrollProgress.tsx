'use client'

import { useEffect, useRef } from 'react'

export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const update = () => {
      const el    = document.documentElement
      const total = el.scrollHeight - el.clientHeight
      const pct   = total > 0 ? el.scrollTop / total : 0
      if (barRef.current) barRef.current.style.transform = `scaleX(${pct})`
    }

    window.addEventListener('scroll', update, { passive: true })
    update()
    return () => window.removeEventListener('scroll', update)
  }, [])

  return (
    <div className="fixed top-16 left-0 right-0 z-50 h-[2px] bg-transparent pointer-events-none">
      <div
        ref={barRef}
        className="h-full bg-amber-400 origin-left will-change-transform"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  )
}
