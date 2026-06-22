'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PageFeedback({ slug }: { slug: string[] }) {
  const [voted, setVoted] = useState<'up' | 'down' | null>(null)
  const pageRef  = slug.join('/') || 'index'
  const issueUrl = `https://github.com/telegraphprotocol/telegraph-docs/issues/new?title=${encodeURIComponent(`Docs feedback: ${pageRef}`)}&labels=feedback&template=blank`

  if (voted) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-[13px] text-[var(--tg-fg-dim)]">
          {voted === 'up' ? 'Thanks for the feedback! 🙌' : "Thanks — we'll improve this."}
        </span>
        {voted === 'down' && (
          <a href={issueUrl} target="_blank" rel="noopener noreferrer"
            className="text-[12px] text-amber-600 dark:text-amber-400 hover:underline transition-colors">
            Tell us more →
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-[12px] text-[var(--tg-fg-faint)] uppercase tracking-[0.08em] font-medium">
        Was this helpful?
      </span>
      <div className="flex items-center gap-2">
        {(['up', 'down'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setVoted(v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-md',
              'border border-[var(--tg-line)] hover:border-[var(--tg-line-strong)]',
              'text-[var(--tg-fg-faint)] hover:text-[var(--tg-fg)]',
              'hover:bg-[var(--tg-line-soft)] transition-all duration-150'
            )}
          >
            {v === 'up' ? <ThumbsUp size={12} /> : <ThumbsDown size={12} />}
            {v === 'up' ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  )
}
