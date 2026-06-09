import { NextRequest, NextResponse } from 'next/server'
import Fuse from 'fuse.js'
import { getAllSlugs, getDocContent, getNavigation, findNavItem } from '@/lib/docs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SearchItem {
  title: string
  href: string
  section: string
  excerpt: string
}

let cachedFuse: Fuse<SearchItem> | null = null

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`[^`]+`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\s*>/gm, '')
    .replace(/\n+/g, ' ')
    .trim()
}

function buildIndex(): Fuse<SearchItem> {
  const slugs = getAllSlugs()
  const nav   = getNavigation()
  const items: SearchItem[] = []

  for (const slug of slugs) {
    const doc = getDocContent(slug)
    if (!doc) continue

    const href = slug.length === 0 ? '/docs' : `/docs/${slug.join('/')}`

    let section = ''
    for (const s of nav) {
      if (findNavItem(s.items, href)) { section = s.title; break }
    }

    items.push({
      title:   doc.title,
      href,
      section,
      excerpt: stripMarkdown(doc.content).slice(0, 220),
    })
  }

  return new Fuse(items, {
    keys: [
      { name: 'title',   weight: 0.65 },
      { name: 'excerpt', weight: 0.35 },
    ],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 2,
  })
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''

  if (q.length < 2) return NextResponse.json([])

  if (!cachedFuse) cachedFuse = buildIndex()

  const results = cachedFuse.search(q, { limit: 8 })

  return NextResponse.json(
    results.map((r) => ({
      title:   r.item.title,
      href:    r.item.href,
      section: r.item.section,
      excerpt: r.item.excerpt,
    }))
  )
}
