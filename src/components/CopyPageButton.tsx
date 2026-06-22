'use client'

import { useState } from 'react'
import { Bot, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CopyPageButton({ content, title }: { content: string; title: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const text = `# ${title}\n\nSource: Telegraph Protocol Documentation\n\n---\n\n${content}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {}
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy page as markdown for LLM"
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] border transition-all duration-150',
        copied
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
          : [
              'border-[var(--tg-line)] hover:border-[var(--tg-line-strong)]',
              'bg-transparent hover:bg-[var(--tg-line-soft)]',
              'text-[var(--tg-fg-faint)] hover:text-[var(--tg-fg-dim)]',
            ]
      )}
    >
      {copied ? <Check size={12} /> : <Bot size={12} />}
      {copied ? 'Copied!' : 'Copy for LLM'}
    </button>
  )
}
