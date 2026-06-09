import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Clock, Calendar } from 'lucide-react'
import { getDocContent, getNavigation, getAllSlugs, getPrevNext } from '@/lib/docs'
import { DocsLayout }       from '@/components/DocsLayout'
import { MDXContent }       from '@/components/MDXContent'
import { Breadcrumb }       from '@/components/Breadcrumb'
import { PageFeedback }     from '@/components/PageFeedback'
import { CodeCopyButtons }  from '@/components/CodeCopyButtons'
import { HeadingAnchors }   from '@/components/HeadingAnchors'
import { CopyPageButton }   from '@/components/CopyPageButton'


interface Props {
  params: { slug?: string[] }
}

// ── Static params ─────────────────────────────────────────────────────────────
export async function generateStaticParams() {
  const slugs = getAllSlugs()
  return slugs.map((slug) => ({ slug: slug.length === 0 ? undefined : slug }))
}

// ── Metadata ──────────────────────────────────────────────────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = params.slug ?? []
  const doc  = getDocContent(slug)
  if (!doc) return { title: 'Not Found' }
  return {
    title: doc.title,
    description: (doc.frontmatter.description as string | undefined) ?? undefined,
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DocsPage({ params }: Props) {
  const slug = params.slug ?? []
  const nav  = getNavigation()
  const doc  = getDocContent(slug)

  if (!doc) notFound()

  const href           = slug.length === 0 ? '/docs' : `/docs/${slug.join('/')}`
  const { prev, next } = getPrevNext(nav, href)

  return (
    <DocsLayout
      nav={nav}
      slug={slug}
      headings={doc.headings}
      prevHref={prev?.href ?? null}
      nextHref={next?.href ?? null}
    >
      {/* Client-side enhancers (no visible output) */}
      <CodeCopyButtons />
      <HeadingAnchors />

      {/* Breadcrumb */}
      <Breadcrumb nav={nav} slug={slug} />

      {/* Page meta bar */}
      <div className="flex items-center flex-wrap gap-x-5 gap-y-1.5 mb-7">
        <span className="flex items-center gap-1.5 text-[12px] text-[var(--tg-fg-faint)]">
          <Clock size={12} className="opacity-60" />
          {doc.readingTime} min read
        </span>
        {doc.lastUpdated && (
          <span className="flex items-center gap-1.5 text-[12px] text-[var(--tg-fg-faint)]">
            <Calendar size={12} className="opacity-60" />
            Updated {doc.lastUpdated}
          </span>
        )}
        <div className="ml-auto">
          <CopyPageButton content={doc.content} title={doc.title} />
        </div>
      </div>

      {/* Content */}
      <MDXContent source={doc.content} />

      {/* Feedback */}
      <div className="mt-10 pt-6 border-t border-[var(--tg-line)]">
        <PageFeedback slug={slug} />
      </div>

      {/* Prev / next navigation */}
      {(prev || next) && (
        <nav className="mt-6 grid grid-cols-2 gap-3">
          <div>
            {prev && (
              <Link
                href={prev.href}
                className="group flex flex-col gap-1 p-4 border border-[var(--tg-line)] rounded-lg hover:border-[var(--tg-line-strong)] hover:bg-[var(--tg-bg-subtle)] transition-all duration-150"
              >
                <span className="flex items-center gap-1 text-[11px] uppercase tracking-[0.1em] text-[var(--tg-fg-faint)]">
                  <ChevronLeft size={11} />
                  Previous
                </span>
                <span className="text-[13px] text-[var(--tg-fg-dim)] group-hover:text-[var(--tg-fg)] transition-colors line-clamp-2">
                  {prev.title}
                </span>
              </Link>
            )}
          </div>
          <div>
            {next && (
              <Link
                href={next.href}
                className="group flex flex-col gap-1 p-4 border border-[var(--tg-line)] rounded-lg hover:border-[var(--tg-line-strong)] hover:bg-[var(--tg-bg-subtle)] transition-all duration-150 text-right"
              >
                <span className="flex items-center justify-end gap-1 text-[11px] uppercase tracking-[0.1em] text-[var(--tg-fg-faint)]">
                  Next
                  <ChevronRight size={11} />
                </span>
                <span className="text-[13px] text-[var(--tg-fg-dim)] group-hover:text-[var(--tg-fg)] transition-colors line-clamp-2">
                  {next.title}
                </span>
              </Link>
            )}
          </div>
        </nav>
      )}

      {/* Keyboard shortcut hint */}
      <div className="mt-6 flex items-center justify-end gap-4 opacity-40 hover:opacity-70 transition-opacity">
        <span className="text-[11px] text-[var(--tg-fg-faint)] font-brand flex items-center gap-1">
          <kbd className="border border-[var(--tg-line)] rounded px-1 text-[10px] bg-[var(--tg-bg-subtle)]">←</kbd>
          <kbd className="border border-[var(--tg-line)] rounded px-1 text-[10px] bg-[var(--tg-bg-subtle)]">→</kbd>
          navigate pages
        </span>
        <span className="text-[11px] text-[var(--tg-fg-faint)] font-brand flex items-center gap-1">
          <kbd className="border border-[var(--tg-line)] rounded px-1 text-[10px] bg-[var(--tg-bg-subtle)]">/</kbd>
          search
        </span>
      </div>
    </DocsLayout>
  )
}
