import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import matter from 'gray-matter'

// Docs root is the project root (where SUMMARY.md and content folders live)
const DOCS_ROOT = process.cwd()

export interface NavItem {
  title:    string
  href:     string
  filePath: string        // original path from SUMMARY.md e.g. "getting-started/core-concepts/message-data.md"
  children?: NavItem[]
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export interface DocHeading {
  text: string
  id: string
  level: number
}

export interface DocContent {
  content: string
  frontmatter: Record<string, unknown>
  headings: DocHeading[]
  title: string
  readingTime: number        // minutes
  lastUpdated: string | null // e.g. "June 2025"
  filePath: string           // relative path in repo, e.g. "getting-started/core-concepts/README.md"
}

// ── Slugify ───────────────────────────────────────────────────────────────────
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')        // strip HTML tags
    .replace(/[^a-z0-9\s-]/g, '')  // remove special chars
    .replace(/\s+/g, '-')          // spaces → dashes
    .replace(/-+/g, '-')           // collapse dashes
    .trim()
}

// ── File path ↔ href conversions ──────────────────────────────────────────────
function filePathToHref(filePath: string): string {
  let href = filePath.replace(/\.md$/i, '')
  href = href.replace(/\/(README|index)$/i, '')
  if (href === 'README' || href === 'index' || href === '') return '/docs'
  return `/docs/${href}`
}

// ── Nav tree building ─────────────────────────────────────────────────────────
function addItemAtDepth(items: NavItem[], item: NavItem, depth: number): void {
  if (depth <= 1) {
    items.push(item)
    return
  }
  const last = items[items.length - 1]
  if (!last) { items.push(item); return }
  if (!last.children) last.children = []
  addItemAtDepth(last.children, item, depth - 1)
}

export function getNavigation(): NavSection[] {
  const summaryPath = path.join(DOCS_ROOT, 'SUMMARY.md')
  if (!fs.existsSync(summaryPath)) return []

  const content = fs.readFileSync(summaryPath, 'utf-8')
  const lines = content.split('\n')
  const sections: NavSection[] = []
  let currentSection: NavSection | null = null

  for (const line of lines) {
    // Section header: ## Title
    if (line.startsWith('## ')) {
      currentSection = { title: line.slice(3).trim(), items: [] }
      sections.push(currentSection)
      continue
    }

    // Nav item: * [Title](path.md)
    const match = line.match(/^(\s*)\*\s+\[([^\]]+)\]\(([^)]+)\)/)
    if (match && currentSection) {
      const indent    = match[1].length
      const title     = match[2]
      const rawPath   = match[3].replace(/\\/g, '/')
      const href      = filePathToHref(rawPath)
      const item: NavItem = { title, href, filePath: rawPath }
      const depth     = Math.floor(indent / 2) + 1
      addItemAtDepth(currentSection.items, item, depth)
    }
  }

  return sections
}

// ── Slug → file path resolution ───────────────────────────────────────────────
export function slugToFilePath(slug: string[]): string | null {
  if (slug.length === 0) {
    const p = path.join(DOCS_ROOT, 'README.md')
    return fs.existsSync(p) ? 'README.md' : null
  }

  const joined = slug.join('/')

  // Try direct match: foo/bar.md
  const direct = path.join(DOCS_ROOT, joined + '.md')
  if (fs.existsSync(direct)) return (joined + '.md').replace(/\\/g, '/')

  // Try directory index: foo/bar/README.md
  const readme = path.join(DOCS_ROOT, joined + '/README.md')
  if (fs.existsSync(readme)) return (joined + '/README.md').replace(/\\/g, '/')

  return null
}

// ── Heading extraction ────────────────────────────────────────────────────────
function extractHeadings(content: string): DocHeading[] {
  const headings: DocHeading[] = []
  for (const line of content.split('\n')) {
    const match = line.match(/^(#{1,6})\s+(.+)/)
    if (!match) continue
    const level = match[1].length
    // Strip inline markdown for plain text
    const text = match[2]
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim()
    headings.push({ text, id: slugify(text), level })
  }
  return headings
}

// ── Reading time ──────────────────────────────────────────────────────────────
function getReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

// ── Last updated (from git log) ───────────────────────────────────────────────
function getLastUpdated(relativeFilePath: string): string | null {
  try {
    const iso = execSync(
      `git log -1 --format=%ai -- "${relativeFilePath}"`,
      { cwd: DOCS_ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim()
    if (!iso) return null
    const date = new Date(iso.split(' ')[0])
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  } catch {
    return null
  }
}

// ── Main content loader ───────────────────────────────────────────────────────
function findFilePathByHref(nav: NavSection[], href: string): string | null {
  function search(items: NavItem[]): string | null {
    for (const item of items) {
      if (item.href === href) return item.filePath
      if (item.children) {
        const found = search(item.children)
        if (found) return found
      }
    }
    return null
  }
  for (const section of nav) {
    const found = search(section.items)
    if (found) return found
  }
  return null
}

export function getDocContent(slug: string[]): DocContent | null {
  const href = slug.length === 0 ? '/docs' : `/docs/${slug.join('/')}`

  // Look up the exact filePath from the nav tree (source of truth: SUMMARY.md)
  const nav      = getNavigation()
  const filePath = findFilePathByHref(nav, href) ?? slugToFilePath(slug)
  if (!filePath) return null

  const fullPath = path.join(DOCS_ROOT, filePath)
  const raw = fs.readFileSync(fullPath, 'utf-8')
  const { content, data } = matter(raw)
  const headings = extractHeadings(content)

  // Derive title: frontmatter → first h1 → filename
  const firstH1 = headings.find((h) => h.level === 1)
  const title =
    (data.title as string) ||
    firstH1?.text ||
    slug[slug.length - 1] ||
    'Documentation'

  return {
    content,
    frontmatter: data,
    headings,
    title,
    readingTime: getReadingTime(content),
    lastUpdated: getLastUpdated(filePath),
    filePath,
  }
}

// ── All slugs (for generateStaticParams) ─────────────────────────────────────
export function getAllSlugs(): string[][] {
  const summaryPath = path.join(DOCS_ROOT, 'SUMMARY.md')
  if (!fs.existsSync(summaryPath)) return [[]]

  const content = fs.readFileSync(summaryPath, 'utf-8')
  const slugs: string[][] = [[]] // root /docs

  for (const match of content.matchAll(/\[([^\]]+)\]\(([^)]+\.md)\)/g)) {
    const filePath = match[2]
    let href = filePath.replace(/\.md$/i, '')
    href = href.replace(/\/(README|index)$/i, '')
    if (href === 'README' || href === 'index' || href === '') continue
    slugs.push(href.split('/'))
  }

  return slugs
}

// ── Find a nav item by href ───────────────────────────────────────────────────
export function findNavItem(
  items: NavItem[],
  href: string
): NavItem | null {
  for (const item of items) {
    if (item.href === href) return item
    if (item.children) {
      const found = findNavItem(item.children, href)
      if (found) return found
    }
  }
  return null
}

// ── Prev / next page links ────────────────────────────────────────────────────
function flattenNav(sections: NavSection[]): NavItem[] {
  const flat: NavItem[] = []
  function traverse(items: NavItem[]) {
    for (const item of items) {
      flat.push(item)
      if (item.children) traverse(item.children)
    }
  }
  for (const s of sections) traverse(s.items)
  return flat
}

export function getPrevNext(
  nav: NavSection[],
  href: string
): { prev: NavItem | null; next: NavItem | null } {
  const flat = flattenNav(nav)
  const idx  = flat.findIndex((i) => i.href === href)
  return {
    prev: idx > 0 ? flat[idx - 1] : null,
    next: idx < flat.length - 1 ? flat[idx + 1] : null,
  }
}
