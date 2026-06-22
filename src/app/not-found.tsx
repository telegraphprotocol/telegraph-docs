import Link from 'next/link'
import { FileQuestion, ArrowRight } from 'lucide-react'
import { getNavigation } from '@/lib/docs'

const QUICK_LINKS = [
  { href: '/docs',                                    label: 'Getting Started' },
  { href: '/docs/getting-started/core-concepts',      label: 'Core Concepts'   },
  { href: '/docs/node-overview/whats-in-a-node',      label: "What's in a Node" },
  { href: '/docs/setup/local-setup',                  label: 'Local Setup'     },
]

export default function NotFound() {
  const nav = getNavigation()
  const sections = nav.slice(0, 5)

  return (
    <div className="min-h-screen bg-[var(--tg-bg)] font-sans flex flex-col items-center justify-center px-6 py-20">

      {/* Icon */}
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl border border-[var(--tg-line)] bg-[var(--tg-bg-subtle)] mb-6">
        <FileQuestion size={28} className="text-[var(--tg-fg-faint)]" />
      </div>

      {/* Heading */}
      <p className="text-[11px] uppercase tracking-[0.25em] text-amber-500 font-brand mb-3">404</p>
      <h1 className="text-2xl font-semibold text-[var(--tg-fg)] mb-3 text-center">
        Page not found
      </h1>
      <p className="text-[14px] text-[var(--tg-fg-faint)] mb-10 text-center max-w-sm leading-relaxed">
        The page you're looking for doesn't exist or may have been moved.
        Try searching or browse the sections below.
      </p>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
        <Link
          href="/docs"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium rounded-lg bg-amber-500 hover:bg-amber-400 text-black transition-colors duration-150"
        >
          Go to Docs
        </Link>
        <Link
          href="https://telegraphprotocol.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] rounded-lg border border-[var(--tg-line)] hover:border-[var(--tg-line-strong)] text-[var(--tg-fg-dim)] hover:text-[var(--tg-fg)] hover:bg-[var(--tg-line-soft)] transition-all duration-150"
        >
          Main Website
        </Link>
      </div>

      {/* Quick links */}
      <div className="w-full max-w-lg">
        <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--tg-fg-faint)] font-brand mb-3 text-center">
          Popular pages
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center justify-between px-4 py-3 rounded-lg border border-[var(--tg-line)] hover:border-[var(--tg-line-strong)] bg-[var(--tg-bg-subtle)] hover:bg-[var(--tg-line-soft)] transition-all duration-150"
            >
              <span className="text-[13px] text-[var(--tg-fg-dim)] group-hover:text-[var(--tg-fg)] transition-colors">
                {link.label}
              </span>
              <ArrowRight size={13} className="text-[var(--tg-fg-faint)] group-hover:text-amber-500 transition-colors" />
            </Link>
          ))}
        </div>
      </div>

      {/* Sections */}
      {sections.length > 0 && (
        <div className="w-full max-w-lg mt-8">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--tg-fg-faint)] font-brand mb-3 text-center">
            Browse by section
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {sections.map((section) => (
              <Link
                key={section.title}
                href={section.items[0]?.href ?? '/docs'}
                className="px-3 py-1.5 rounded-md text-[12px] border border-[var(--tg-line)] hover:border-amber-500/40 text-[var(--tg-fg-faint)] hover:text-amber-500 hover:bg-amber-500/5 transition-all duration-150"
              >
                {section.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
