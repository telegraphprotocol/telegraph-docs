'use client'

import { useEffect, useRef } from 'react'
import { ArrowUp } from 'lucide-react'

export function BackToTop() {
  const btnRef  = useRef<HTMLButtonElement>(null)
  const fillRef = useRef<HTMLSpanElement>(null)
  const clipRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const onScroll = () => {
      const el      = document.documentElement
      const total   = el.scrollHeight - el.clientHeight
      const pct     = total > 0 ? el.scrollTop / total : 0
      const visible = el.scrollTop > 100

      if (btnRef.current) {
        btnRef.current.style.opacity       = visible ? '1' : '0'
        btnRef.current.style.pointerEvents = visible ? 'auto' : 'none'
      }
      if (fillRef.current) {
        fillRef.current.style.transform = `scaleY(${pct})`
      }
      if (clipRef.current) {
        // clip region matches the fill — inset from top = (1 - pct) * 100%
        clipRef.current.style.clipPath = `inset(${(1 - pct) * 100}% 0 0 0)`
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const content = (
    <>
      <ArrowUp size={12} className="flex-shrink-0" />
      <span
        className="text-[9px] font-semibold tracking-[0.18em] uppercase font-brand"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      >
        Back to top
      </span>
    </>
  )

  return (
    <button
      ref={btnRef}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className="group fixed bottom-10 z-50 hidden xl:flex flex-col items-center gap-2.5 py-4 px-2 rounded-full border border-[var(--tg-line)] overflow-hidden bg-[var(--tg-bg-subtle)] hover:border-amber-500/60 transition-colors duration-200"
      style={{
        right: 'calc(1.5rem + 18rem)',
        opacity: 0,
        pointerEvents: 'none',
        transition: 'opacity 250ms ease, border-color 150ms',
      }}
    >
      {/* Amber fill — grows from bottom */}
      <span
        ref={fillRef}
        aria-hidden
        className="absolute inset-0 bg-amber-500 origin-bottom will-change-transform"
        style={{ transform: 'scaleY(0)' }}
      />

      {/* Default colour layer */}
      <span className="relative z-10 flex flex-col items-center gap-2.5 text-[var(--tg-fg-faint)]">
        {content}
      </span>

      {/* Black text layer — clipped to only show over the amber fill */}
      <span
        ref={clipRef}
        aria-hidden
        className="absolute inset-0 z-20 flex flex-col items-center gap-2.5 py-4 px-2 text-black will-change-[clip-path]"
        style={{ clipPath: 'inset(100% 0 0 0)' }}
      >
        {content}
      </span>
    </button>
  )
}
