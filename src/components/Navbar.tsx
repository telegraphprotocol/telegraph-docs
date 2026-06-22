'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, Github, ExternalLink, Search } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { cn } from '@/lib/utils'

interface NavbarProps {
  menuOpen:     boolean
  onMenuToggle: () => void
  onSearchOpen: () => void
}

export function Navbar({ menuOpen, onMenuToggle, onSearchOpen }: NavbarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[var(--tg-bg)]/90 backdrop-blur-md border-b border-[var(--tg-line)]">
      <div className="flex items-center h-full px-4 md:px-6 gap-3">

        {/* Mobile hamburger — left side, controls left sidebar */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden flex items-center justify-center w-8 h-8 rounded-md text-[var(--tg-fg)] hover:bg-[var(--tg-line-soft)] border border-transparent hover:border-[var(--tg-line)] transition-colors"
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        {/* Logo */}
        <Link href="/docs" className="flex items-center gap-2.5 group flex-shrink-0">
          <Image
            src="/t-logo.png"
            alt="Telegraph"
            width={24}
            height={24}
            className="h-[22px] w-auto opacity-90 group-hover:opacity-100 transition-opacity dark:invert-0 invert"
          />
          <span className="text-[15px] font-semibold text-[var(--tg-fg)] tracking-tight hidden sm:block">
            Telegraph
          </span>
          <span className="px-1.5 py-[2px] text-[10px] font-semibold uppercase tracking-[0.12em] rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-brand">
            Docs
          </span>
        </Link>

        {/* Search (desktop) */}
        <button
          onClick={onSearchOpen}
          className={cn(
            'hidden md:flex items-center gap-2 ml-4',
            'px-3 py-[7px] w-52 rounded-lg',
            'border border-[var(--tg-line)] hover:border-[var(--tg-line-strong)]',
            'bg-[var(--tg-bg-subtle)] hover:bg-[var(--tg-line-soft)]',
            'text-[var(--tg-fg-faint)] transition-all duration-150',
          )}
        >
          <Search size={13} />
          <span className="text-[13px] flex-1 text-left">Search...</span>
          <kbd className="text-[10px] font-brand border border-[var(--tg-line)] rounded px-1 py-0.5 bg-[var(--tg-bg)]">
            ⌘K
          </kbd>
        </button>

        <div className="flex-1" />

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          <a
            href="https://telegraphprotocol.com"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px]',
              'text-[var(--tg-fg-faint)] hover:text-[var(--tg-fg)]',
              'hover:bg-[var(--tg-line-soft)]',
              'transition-colors duration-150',
            )}
          >
            <span>Website</span>
            <ExternalLink size={11} className="opacity-50" />
          </a>

          <a
            href="https://github.com/telegraphprotocol"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-md',
              'text-[var(--tg-fg-faint)] hover:text-[var(--tg-fg)]',
              'hover:bg-[var(--tg-line-soft)]',
              'border border-transparent hover:border-[var(--tg-line)]',
              'transition-colors duration-150',
            )}
            aria-label="GitHub"
          >
            <Github size={16} />
          </a>

          <ThemeToggle />

          {/* Mobile: search */}
          <button
            onClick={onSearchOpen}
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded-md text-[var(--tg-fg-faint)] hover:text-[var(--tg-fg)] hover:bg-[var(--tg-line-soft)] transition-colors"
            aria-label="Search"
          >
            <Search size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
