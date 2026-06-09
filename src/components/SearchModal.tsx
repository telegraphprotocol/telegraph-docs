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

interface SearchModalProps {
  onClose: () => void
}

export function SearchModal({ onClose }: SearchModalProps) {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<SearchResult[]>([])
  const [selected, setSelected] = useState(0)
  const [loading,  setLoading]  = useState(false)
  const inputRef  = useRef<HTMLInputElement>(null)
  const listRef   = useRef<HTMLDivElement>(null)
  const router    = useRouter()

  useEffect(() => { inputRef.current?.focus() }, [])

  // Debounced search
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

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((s) => Math.min(s + 1, results.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((s) => Math.max(s - 1, 0))
      }
      if (e.key === 'Enter' && results[selected]) {
        navigate(results[selected].href)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [results, selected, navigate, onClose])

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-selected="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-[#080808] border border-[#2a2a2a] rounded-lg shadow-2xl overflow-hidden animate-[fadeUp_0.15s_ease_forwards]">
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 border-b border-[#2a2a2a]">
          {loading
            ? <Loader2 size={14} className="text-amber-400 flex-shrink-0 animate-spin" />
            : <Search size={14} className="text-tg-fg-faint flex-shrink-0" />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documentation..."
            className="flex-1 py-4 bg-transparent text-[13px] text-tg-fg placeholder:text-tg-fg-faint outline-none font-mono"
          />
          <button
            onClick={onClose}
            className="p-1 text-tg-fg-faint hover:text-tg-fg transition-colors"
          >
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
                  'w-full text-left px-4 py-3 flex items-start gap-3 transition-colors group',
                  i === selected ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'
                )}
              >
                <div className="flex-1 min-w-0">
                  {result.section && (
                    <div className="text-[9px] uppercase tracking-[0.18em] text-amber-500/60 mb-0.5 font-mono">
                      {result.section}
                    </div>
                  )}
                  <div className="text-[13px] text-tg-fg font-medium font-mono mb-1 truncate">
                    {result.title}
                  </div>
                  <div className="text-[11px] text-tg-fg-faint leading-relaxed line-clamp-2">
                    {result.excerpt}
                  </div>
                </div>
                <ArrowRight
                  size={12}
                  className={cn(
                    'flex-shrink-0 mt-1 transition-colors',
                    i === selected ? 'text-amber-400' : 'text-tg-fg-faint'
                  )}
                />
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {query.length >= 2 && !loading && results.length === 0 && (
          <div className="px-4 py-10 text-center">
            <div className="text-[11px] text-tg-fg-faint font-mono">
              No results for <span className="text-tg-fg">"{query}"</span>
            </div>
          </div>
        )}

        {/* Default hint */}
        {query.length < 2 && !loading && (
          <div className="px-4 py-6 text-center">
            <div className="text-[11px] text-tg-fg-faint font-mono">
              Type to search across all documentation
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[#1c1c1c] flex items-center gap-4">
          {[
            ['↑↓', 'navigate'],
            ['↵',  'open'],
            ['esc','close'],
          ].map(([key, label]) => (
            <span key={key} className="flex items-center gap-1.5 text-[10px] text-tg-fg-faint font-mono">
              <kbd className="px-1.5 py-0.5 border border-[#3a3a3a] rounded text-[9px] bg-white/[0.03]">
                {key}
              </kbd>
              {label}
            </span>
          ))}
          <div className="flex-1" />
          <span className="text-[9px] text-tg-fg-faint/50 font-mono">telegraph docs</span>
        </div>
      </div>
    </div>
  )
}
