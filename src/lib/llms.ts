import path from 'path'
import { getNavigation, getDocContent, type NavItem } from '@/lib/docs'

// Plain-text views of the docs for AI tools: /llms.txt (index), /llms-full.txt
// (every page in one file) and /docs/<page>.md (one page as raw Markdown).
// All three are built from the same Markdown files the site renders, so they
// can never say something different from the pages themselves.

export const SITE_URL = 'https://docs.telegraphprotocol.com'

export interface LlmsPage {
  section:     string
  title:       string
  description: string
  pageUrl:     string   // https://…/docs/using/intents
  mdUrl:       string   // https://…/docs/using/intents.md
  slug:        string[]
}

function hrefToSlug(href: string): string[] {
  return href.replace(/^\/docs\/?/, '').split('/').filter(Boolean)
}

// mdPathForHref is the .md URL path for a page href. The docs root (/docs)
// has no name of its own, so it is served as /docs/index.md.
export function mdPathForHref(href: string): string {
  return href === '/docs' ? '/docs/index.md' : `${href}.md`
}

// listPages walks SUMMARY.md in reading order. A page listed twice is kept once.
export function listPages(): LlmsPage[] {
  const pages: LlmsPage[] = []
  const seen = new Set<string>()

  function visit(section: string, items: NavItem[]) {
    for (const item of items) {
      if (!seen.has(item.href)) {
        seen.add(item.href)
        const slug = hrefToSlug(item.href)
        const doc  = getDocContent(slug)
        if (doc) {
          pages.push({
            section,
            title:       item.title,
            description: String(doc.frontmatter.description ?? '').trim(),
            pageUrl:     SITE_URL + item.href,
            mdUrl:       SITE_URL + mdPathForHref(item.href),
            slug,
          })
        }
      }
      if (item.children) visit(section, item.children)
    }
  }

  for (const s of getNavigation()) visit(s.title, s.items)
  return pages
}

// absolutizeLinks rewrites the relative links between pages (../miners/x.md,
// ./y.md#anchor) into full .md URLs, so a link still works once the text has
// been pasted into a chat or fetched by an agent with no idea where it came
// from. Image paths get the same treatment. Resolution matches the site's
// own renderer (MDXContent.resolveDocHref).
export function absolutizeLinks(content: string, filePath: string): string {
  const dir = path.posix.dirname(filePath.replace(/\\/g, '/'))
  const base = dir === '.' ? '' : dir

  return content.replace(/(!?)\[([^\]]*)\]\(([^)\s]+)\)/g, (whole, bang: string, text: string, href: string) => {
    if (/^(https?:|mailto:|#)/i.test(href)) return whole

    const hashIndex = href.indexOf('#')
    const fragment  = hashIndex === -1 ? '' : href.slice(hashIndex)
    const target    = hashIndex === -1 ? href : href.slice(0, hashIndex)
    const joined    = path.posix
      .join(target.startsWith('/') ? '' : base, target)
      .replace(/^\/+/, '')

    if (/\.md$/i.test(joined)) {
      const page = joined.replace(/\.md$/i, '').replace(/\/?(README|index)$/i, '')
      const href = page === '' || page === '.' ? '/docs' : `/docs/${page}`
      return `${bang}[${text}](${SITE_URL}${mdPathForHref(href)}${fragment})`
    }
    return `${bang}[${text}](${SITE_URL}/${joined}${fragment})`
  })
}

// pageMarkdown is one page as an AI should read it: title, where it lives,
// what it is for, then the body with working links.
export function pageMarkdown(slug: string[]): string | null {
  const doc = getDocContent(slug)
  if (!doc) return null

  const href        = slug.length === 0 ? '/docs' : `/docs/${slug.join('/')}`
  const description = String(doc.frontmatter.description ?? '').trim()
  const body        = absolutizeLinks(doc.content, doc.filePath).trim()

  // Most pages open with their own "# Title"; don't print it twice.
  const startsWithTitle = /^#\s+/.test(body)
  const header = [
    startsWithTitle ? null : `# ${doc.title}`,
    `Source: ${SITE_URL}${href}`,
    description ? `> ${description}` : null,
  ].filter(Boolean).join('\n\n')

  return startsWithTitle
    ? body.replace(/^(#\s+[^\n]*\n)/, `$1\n${header}\n`) + '\n'
    : `${header}\n\n${body}\n`
}

const INTRO =
  'Telegraph is a permissionless marketplace for verified intelligence: agents pay ' +
  'in USDC for a result, Miners compete to supply it, and Validators score the ' +
  'answers and rank the miners.'

export function llmsIndex(): string {
  const pages = listPages()
  const lines: string[] = [
    '# Telegraph Protocol Documentation',
    '',
    `> ${INTRO}`,
    '',
    'Every page below is available as plain Markdown at the linked .md URL. ' +
    `The whole documentation is also available as a single file: ${SITE_URL}/llms-full.txt`,
  ]

  let section = ''
  for (const p of pages) {
    if (p.section !== section) {
      section = p.section
      lines.push('', `## ${section}`, '')
    }
    lines.push(`- [${p.title}](${p.mdUrl})${p.description ? `: ${p.description}` : ''}`)
  }
  return lines.join('\n') + '\n'
}

export function llmsFull(): string {
  const parts = [
    `# Telegraph Protocol Documentation\n\n> ${INTRO}\n\n` +
    `This file contains every page of ${SITE_URL}, in reading order. ` +
    'Pages are separated by a line of dashes.',
  ]
  for (const p of listPages()) {
    const md = pageMarkdown(p.slug)
    if (md) parts.push(md.trim())
  }
  return parts.join('\n\n---\n\n') + '\n'
}
