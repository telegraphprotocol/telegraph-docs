import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { NavSection, NavItem } from '@/lib/docs'

interface BreadcrumbProps {
  nav: NavSection[]
  slug: string[]
}

function findItem(items: NavItem[], href: string): NavItem | null {
  for (const item of items) {
    if (item.href === href) return item
    if (item.children) {
      const found = findItem(item.children, href)
      if (found) return found
    }
  }
  return null
}

export function Breadcrumb({ nav, slug }: BreadcrumbProps) {
  const href = slug.length === 0 ? '/docs' : `/docs/${slug.join('/')}`

  let sectionTitle = ''
  let itemTitle    = ''

  for (const section of nav) {
    const found = findItem(section.items, href)
    if (found) {
      sectionTitle = section.title
      itemTitle    = found.title
      break
    }
  }

  if (!sectionTitle) return null

  return (
    <nav className="flex items-center flex-wrap gap-1 text-[11px] text-tg-fg-faint mb-7 font-mono">
      <Link href="/docs" className="hover:text-tg-fg-dim transition-colors uppercase tracking-wider">
        Docs
      </Link>
      {sectionTitle && (
        <>
          <ChevronRight size={11} className="opacity-40 flex-shrink-0" />
          <span className="text-tg-fg-faint uppercase tracking-wider">{sectionTitle}</span>
        </>
      )}
      {itemTitle && itemTitle !== sectionTitle && (
        <>
          <ChevronRight size={11} className="opacity-40 flex-shrink-0" />
          <span className="text-tg-fg-dim">{itemTitle}</span>
        </>
      )}
    </nav>
  )
}
