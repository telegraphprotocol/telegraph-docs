'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, ArrowRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchResult {
  title: string
  href: string
  section: string
  excerpt: string
}

export function SearchModal({ onClose }: { onClose: () => void }) {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<SearchResult[]>([])
  const [selected, setSelected] = useState(0)
  const [loading,  setLoading]  = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)
  const router   = useRouter()

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); setLoading(false); return }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data)
        setSelected(0)
      } catch {}
      setLoading(false)
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  const navigate = useCallback((href: string) => {
    router.push(href)
    onClose()
  }, [router, onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
      if (e.key === 'Enter' && results[selected]) navigate(results[selected].href)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [results, selected, navigate, onClose])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 dark:bg-black/75 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className={cn(
        'relative w-full max-w-xl rounded-xl shadow-2xl overflow-hidden',
        'bg-[var(--tg-bg)] border border-[var(--tg-line)]',
        'animate-[fadeUp_0.15s_ease_forwards]',
      )}>
        {/* Input */}
        <div className="flex items-center gap-3 px-4 border-b border-[var(--tg-line)]">
          {loading
            ? <Loader2 size={14} className="text-amber-500 flex-shrink-0 animate-spin" />
            : <Search size={14} className="text-[var(--tg-fg-faint)] flex-shrink-0" />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documentation..."
            className="flex-1 py-4 bg-transparent text-[14px] text-[var(--tg-fg)] placeholder:text-[var(--tg-fg-faint)] outline-none font-sans"
          />
          <button onClick={onClose} className="p-1 text-[var(--tg-fg-faint)] hover:text-[var(--tg-fg)] transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div ref={listRef} className="max-h-[340px] overflow-y-auto py-1.5">
            {results.map((result, i) => (
              <button
                key={result.href}
                data-selected={i === selected}
                onClick={() => navigate(result.href)}
                onMouseEnter={() => setSelected(i)}
                className={cn(
                  'w-full text-left px-4 py-3 flex items-start gap-3 transition-colors',
                  i === selected
                    ? 'bg-[var(--tg-line-soft)]'
                    : 'hover:bg-[var(--tg-bg-subtle)]'
                )}
              >
                <div className="flex-1 min-w-0">
                  {result.section && (
                    <p className="text-[10px] uppercase tracking-[0.15em] text-amber-600 dark:text-amber-500 mb-0.5 font-brand">
                      {result.section}
                    </p>
                  )}
                  <p className="text-[13.5px] font-semibold text-[var(--tg-fg)] mb-0.5 truncate">{result.title}</p>
                  <p className="text-[12px] text-[var(--tg-fg-faint)] leading-relaxed line-clamp-2">{result.excerpt}</p>
                </div>
                <ArrowRight size={12} className={cn('flex-shrink-0 mt-1', i === selected ? 'text-amber-500' : 'text-[var(--tg-fg-faint)]')} />
              </button>
            ))}
          </div>
        )}

        {/* Empty */}
        {query.length >= 2 && !loading && results.length === 0 && (
          <div className="px-4 py-10 text-center text-[13px] text-[var(--tg-fg-faint)]">
            No results for <span className="text-[var(--tg-fg)] font-medium">"{query}"</span>
          </div>
        )}

        {/* Hint */}
        {query.length < 2 && (
          <div className="px-4 py-7 text-center text-[13px] text-[var(--tg-fg-faint)]">
            Type to search across all documentation
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[var(--tg-line)] flex items-center gap-4 bg-[var(--tg-bg-subtle)]">
          {[['↑↓','navigate'],['↵','open'],['esc','close']].map(([key, label]) => (
            <span key={key} className="flex items-center gap-1.5 text-[11px] text-[var(--tg-fg-faint)]">
              <kbd className="px-1.5 py-0.5 border border-[var(--tg-line-strong)] rounded text-[10px] bg-[var(--tg-bg)] font-brand">
                {key}
              </kbd>
              {label}
            </span>
          ))}
          <div className="flex-1" />
          <span className="text-[11px] text-[var(--tg-fg-faint)] font-brand">telegraph docs</span>
        </div>
      </div>
    </div>
  )
}
