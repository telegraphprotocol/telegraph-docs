'use client'

import { useState } from 'react'
import { Bot, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CopyPageButtonProps {
  content: string
  title: string
}

export function CopyPageButton({ content, title }: CopyPageButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    // Prepend a brief context header so the LLM knows what it's reading
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
        'flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-mono',
        'text-[11px] border transition-all duration-150',
        copied
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
          : 'border-[#2a2a2a] hover:border-[#3a3a3a] bg-transparent hover:bg-white/[0.03] text-tg-fg-faint hover:text-tg-fg-dim'
      )}
    >
      {copied ? <Check size={11} /> : <Bot size={11} />}
      {copied ? 'Copied!' : 'Copy for LLM'}
    </button>
  )
}
