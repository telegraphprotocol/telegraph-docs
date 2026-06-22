'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname   = usePathname()
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    el.style.opacity   = '0'
    el.style.transform = 'translateY(6px)'
    const raf = requestAnimationFrame(() => {
      el.style.transition = 'opacity 200ms ease, transform 200ms ease'
      el.style.opacity    = '1'
      el.style.transform  = 'translateY(0)'
    })
    return () => cancelAnimationFrame(raf)
  }, [pathname])

  return (
    <div ref={wrapperRef} style={{ opacity: 0 }}>
      {children}
    </div>
  )
}
