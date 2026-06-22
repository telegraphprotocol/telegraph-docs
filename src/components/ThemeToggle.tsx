'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('tg-theme') as 'dark' | 'light' | null
    const preferred = saved ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    apply(preferred)
    setTheme(preferred)
  }, [])

  function apply(t: 'dark' | 'light') {
    document.documentElement.classList.toggle('dark', t === 'dark')
    localStorage.setItem('tg-theme', t)
  }

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    apply(next)
    setTheme(next)
  }

  if (!mounted) return <div className="w-8 h-8" />

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className={cn(
        'inline-flex items-center justify-center w-8 h-8 rounded-md',
        'text-tg-fg-faint hover:text-tg-fg',
        'hover:bg-[var(--tg-line-soft)]',
        'transition-colors duration-150',
        'border border-transparent hover:border-[var(--tg-line)]',
      )}
    >
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  )
}
