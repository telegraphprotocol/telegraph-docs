'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PageFeedbackProps {
  slug: string[]
}

export function PageFeedback({ slug }: PageFeedbackProps) {
  const [voted, setVoted] = useState<'up' | 'down' | null>(null)

  const pageRef   = slug.join('/') || 'index'
  const issueUrl  = `https://github.com/telegraphprotocol/telegraph-docs/issues/new?title=${encodeURIComponent(`Docs feedback: ${pageRef}`)}&labels=feedback&template=blank`

  if (voted) {
    return (
      <div className="flex items-center gap-3 font-mono">
        <span className="text-[12px] text-tg-fg-dim">
          {voted === 'up' ? 'Thanks for the feedback! 🙌' : 'Thanks — we\'ll improve this.'}
        </span>
        {voted === 'down' && (
          <a
            href={issueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-amber-400 hover:text-amber-300 transition-colors"
          >
            Tell us more →
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 font-mono">
      <span className="text-[12px] text-tg-fg-faint uppercase tracking-[0.1em]">
        Was this helpful?
      </span>
      <div className="flex items-center gap-2">
        {(['up', 'down'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setVoted(v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-[11px]',
              'border border-[#2a2a2a] rounded-sm',
              'text-tg-fg-faint hover:text-tg-fg',
              'hover:border-[#3a3a3a] hover:bg-white/[0.03]',
              'transition-all duration-150'
            )}
          >
            {v === 'up'
              ? <ThumbsUp  size={11} />
              : <ThumbsDown size={11} />
            }
            {v === 'up' ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  )
}
