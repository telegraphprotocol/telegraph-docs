import { NextRequest, NextResponse } from 'next/server'
import Fuse from 'fuse.js'
import { getAllSlugs, getDocContent, getNavigation, findNavItem } from '@/lib/docs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SearchItem {
  title:   string
  href:    string
  section: string
  body:    string   // full stripped content for indexing
}

let cachedFuse:  Fuse<SearchItem> | null = null
let cachedItems: SearchItem[]            = []

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
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

// Return a ~180-char snippet centred on the first occurrence of `query`
function getSnippet(body: string, query: string): string {
  const lower = body.toLowerCase()
  const idx   = lower.indexOf(query.toLowerCase())
  if (idx === -1) return body.slice(0, 180).trim() + '…'

  const start = Math.max(0, idx - 60)
  const end   = Math.min(body.length, idx + query.length + 120)
  const snippet = (start > 0 ? '…' : '') + body.slice(start, end).trim() + (end < body.length ? '…' : '')
  return snippet
}

function buildIndex(): void {
  const slugs = getAllSlugs()
  const nav   = getNavigation()
  cachedItems  = []

  for (const slug of slugs) {
    const doc = getDocContent(slug)
    if (!doc) continue

    const href = slug.length === 0 ? '/docs' : `/docs/${slug.join('/')}`

    let section = ''
    for (const s of nav) {
      if (findNavItem(s.items, href)) { section = s.title; break }
    }

    cachedItems.push({
      title: doc.title,
      href,
      section,
      body:  stripMarkdown(doc.content),
    })
  }

  cachedFuse = new Fuse(cachedItems, {
    keys: [
      { name: 'title', weight: 0.6 },
      { name: 'body',  weight: 0.4 },
    ],
    threshold:        0.35,
    includeScore:     true,
    minMatchCharLength: 2,
    ignoreLocation:   true,   // match anywhere in the body, not just near the start
    distance:         100000, // effectively unlimited
  })
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''

  if (q.length < 2) return NextResponse.json([])

  if (!cachedFuse) buildIndex()

  const results = cachedFuse!.search(q, { limit: 8 })

  return NextResponse.json(
    results.map((r) => ({
      title:   r.item.title,
      href:    r.item.href,
      section: r.item.section,
      excerpt: getSnippet(r.item.body, q),
    }))
  )
}
