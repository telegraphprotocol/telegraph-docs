'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, Github, ExternalLink, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavbarProps {
  menuOpen: boolean
  onMenuToggle: () => void
  onSearchOpen: () => void
}

export function Navbar({ menuOpen, onMenuToggle, onSearchOpen }: NavbarProps) {
  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50',
        'h-[72px] flex items-center',
        'border-b border-[#2a2a2a]',
        'bg-[#010101]/50 backdrop-blur-md',
      )}
    >
      <div className="flex w-full items-center justify-between px-6 md:px-10">

        {/* Logo */}
        <Link
          href="/docs"
          className="flex items-center gap-2.5 text-[var(--tg-fg)] no-underline group"
        >
          <Image
            src="/t-logo.png"
            alt="Telegraph"
            width={28}
            height={28}
            className="h-5 w-auto opacity-90 group-hover:opacity-100 transition-opacity"
          />
          <span className="font-medium text-[15px] tracking-[0.05em] hidden sm:block">
            Telegraph
          </span>
          {/* DOCS badge — same amber style as main site token report badge */}
          <span
            className={cn(
              'inline-flex items-center whitespace-nowrap rounded-sm',
              'border border-amber-500/80 bg-amber-500/10',
              'px-2 py-[3px]',
              'text-[10px] font-semibold uppercase tracking-[0.12em] leading-none',
              'text-amber-400',
            )}
          >
            Docs
          </span>
        </Link>

        {/* Search bar (desktop) */}
        <button
          onClick={onSearchOpen}
          className={cn(
            'hidden md:flex items-center gap-2.5 mx-4',
            'px-3 py-[7px] rounded-sm',
            'border border-[#2a2a2a] hover:border-[#3a3a3a]',
            'bg-white/[0.02] hover:bg-white/[0.04]',
            'text-tg-fg-faint hover:text-tg-fg-dim',
            'transition-all duration-150 w-52',
          )}
        >
          <Search size={12} />
          <span className="text-[11px] font-mono flex-1 text-left">Search docs...</span>
          <kbd className="text-[9px] font-mono border border-[#3a3a3a] rounded px-1 py-0.5 bg-white/[0.03]">
            ⌘K
          </kbd>
        </button>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-3">
          {/* Plain nav links — hackathon style: 10px uppercase monospace */}
          <a
            href="https://github.com/telegraphprotocol"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex items-center gap-1.5',
              'text-[10px] font-mono uppercase tracking-[0.12em]',
              'text-[var(--tg-fg)] opacity-70 hover:opacity-100 transition-opacity',
              'no-underline',
            )}
          >
            GitHub
            <ExternalLink size={9} />
          </a>

          {/* Divider */}
          <span className="h-4 w-px bg-[#2a2a2a]" />

          {/* Main site CTA — dark variant */}
          <a
            href="https://telegraphprotocol.com"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'group inline-flex items-center gap-2 whitespace-nowrap rounded-sm',
              'bg-[#1a1a1a] hover:bg-[#222]',
              'px-[14px] py-[9px]',
              'text-[13px] font-medium leading-none text-[var(--tg-fg)]',
              'no-underline transition-all',
            )}
          >
            telegraphprotocol.com
            <ExternalLink size={11} className="opacity-50 group-hover:opacity-80 transition-opacity" />
          </a>
        </div>

        {/* Mobile right side */}
        <div className="md:hidden flex items-center gap-2">
          {/* Mobile search */}
          <button
            onClick={onSearchOpen}
            className="inline-flex items-center justify-center rounded-sm bg-[#1a1a1a] hover:bg-[#222] p-[10px] text-tg-fg-dim transition-colors"
            aria-label="Search"
          >
            <Search size={15} />
          </button>
          {/* Hamburger */}
          <button
            onClick={onMenuToggle}
            className={cn(
              'inline-flex items-center justify-center rounded-sm',
              'bg-[#1a1a1a] hover:bg-[#222] p-[10px]',
              'text-[var(--tg-fg)] transition-colors',
            )}
            aria-label="Toggle navigation"
          >
            {menuOpen ? <X size={15} /> : <Menu size={15} />}
          </button>
        </div>
      </div>
    </header>
  )
}
