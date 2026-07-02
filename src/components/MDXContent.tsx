import { marked } from 'marked'
import hljs from 'highlight.js'
import path from 'path'
import { slugify } from '@/lib/docs'

// ── Custom marked renderer (legacy function-signature API) ────────────────────
marked.use({
  renderer: {
    heading(text: string, depth: number): string {
      const plain = text.replace(/<[^>]+>/g, '')
      const id    = slugify(plain)
      return `<h${depth} id="${id}">${text}</h${depth}>\n`
    },

    code(code: string, infostring: string | undefined): string {
      const lang        = (infostring || 'plaintext').split(/\s/)[0].toLowerCase()
      const displayLang = lang === 'plaintext' ? '' : lang

      let highlighted = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

      try {
        if (hljs.getLanguage(lang)) {
          highlighted = hljs.highlight(code, { language: lang }).value
        } else {
          highlighted = hljs.highlightAuto(code).value
        }
      } catch {
        // fallback: escaped plain text
      }

      const header = displayLang
        ? `<div class="code-block-header"><span class="code-block-lang">${displayLang}</span></div>`
        : `<div class="code-block-header"></div>`

      return (
        `<div class="code-block">` +
        header +
        `<pre><code class="hljs${lang ? ` language-${lang}` : ''}">${highlighted}</code></pre>` +
        `</div>\n`
      )
    },

    table(header: string, body: string): string {
      // Detect "I want to… / Go here" nav-card tables
      if (/<th[^>]*>\s*I want to/i.test(header)) {
        const rowMatches = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
        const ICONS: [RegExp, string][] = [
          [/protocol mechanic|how it works/i,   '⚙️'],
          [/tokenomics|machina/i,                '🪙'],
          [/address|parameter/i,                 '📋'],
          [/http|x402|pay per call/i,            '🌐'],
          [/engine/i,                            '🤖'],
          [/websocket|signal feed/i,             '📡'],
          [/smart contract|on-chain|erc/i,       '🔗'],
          [/miner|earn/i,                        '⛏️'],
          [/validator|node/i,                    '🛡️'],
          [/role/i,                              '👥'],
        ]
        const cards = rowMatches.map((m) => {
          const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
          const label = cells[0]?.[1].replace(/<[^>]+>/g, '').trim() ?? ''
          const dest  = cells[1]?.[1] ?? ''
          const href  = dest.match(/href="([^"]+)"/)?.[1] ?? '#'
          const title = dest.replace(/<[^>]+>/g, '').trim()
          const icon  = ICONS.find(([re]) => re.test(label + title))?.[1] ?? '📄'
          return (
            `<a href="${href}" class="tg-nav-card">` +
            `<span class="tg-nav-card-icon">${icon}</span>` +
            `<span class="tg-nav-card-body">` +
            `<span class="tg-nav-card-title">${title}</span>` +
            `<span class="tg-nav-card-label">${label}</span>` +
            `</span>` +
            `<span class="tg-nav-card-arrow">→</span>` +
            `</a>`
          )
        }).join('')
        return `<div class="tg-nav-cards">${cards}</div>\n`
      }
      return (
        `<div class="tg-table-wrap">` +
        `<table><thead>${header}</thead><tbody>${body}</tbody></table>` +
        `</div>\n`
      )
    },

    blockquote(body: string): string {
      // GitHub-style callouts: > [!NOTE], > [!TIP], > [!WARNING], > [!DANGER], > [!IMPORTANT]
      const match = body.match(/^\s*<p>\[!(NOTE|TIP|WARNING|DANGER|IMPORTANT)\]([\s\S]*?)<\/p>/i)
      if (match) {
        const type  = match[1].toUpperCase()
        const rest  = match[2].trim()
        const icons: Record<string, string> = {
          NOTE:      '📝',
          TIP:       '💡',
          WARNING:   '⚠️',
          DANGER:    '🚨',
          IMPORTANT: '⭐',
        }
        return (
          `<div class="callout callout-${type.toLowerCase()}">` +
          `<div class="callout-title"><span class="callout-icon">${icons[type]}</span>${type.charAt(0) + type.slice(1).toLowerCase()}</div>` +
          `<div class="callout-body">${rest}</div>` +
          `</div>\n`
        )
      }
      return `<blockquote>${body}</blockquote>\n`
    },

    link(href: string, _title: string | null | undefined, text: string): string {
      const isExternal = href.startsWith('http://') || href.startsWith('https://')
      const attrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''

      // Resolve relative .md links → /docs/...
      let resolvedHref = href
      if (!isExternal && href.endsWith('.md')) {
        resolvedHref =
          '/docs/' +
          href
            .replace(/\.md$/, '')
            .replace(/\/?(README|index)$/i, '')
      }

      return `<a href="${resolvedHref}"${attrs}>${text}</a>`
    },
  },
})

// ── Relative .md link resolver ───────────────────────────────────────────────
function resolveRelativeLinks(content: string, filePath: string): string {
  const baseDir = filePath.replace(/\/[^/]*$/, '')
  return content.replace(
    /\[([^\]]*)\]\(((?!https?:\/\/)(?!\/|#|mailto:)[^)]+\.md)\)/g,
    (_match, text, href) => {
      const resolved = path.normalize(path.join(baseDir, href)).replace(/\\/g, '/')
      return `[${text}](${resolved})`
    }
  )
}

// ── LaTeX / GitBook preprocessor ─────────────────────────────────────────────
const LATEX_SYMBOLS: [RegExp, string][] = [
  [/\\leftrightarrow/g,  '↔'],
  [/\\rightarrow/g,      '→'],
  [/\\leftarrow/g,       '←'],
  [/\\Rightarrow/g,      '⇒'],
  [/\\Leftarrow/g,       '⇐'],
  [/\\Leftrightarrow/g,  '⟺'],
  [/\\to\b/g,            '→'],
  [/\\ge\b/g,            '≥'],
  [/\\le\b/g,            '≤'],
  [/\\neq\b/g,           '≠'],
  [/\\approx\b/g,        '≈'],
  [/\\times\b/g,         '×'],
  [/\\cdot\b/g,          '·'],
  [/\\pm\b/g,            '±'],
  [/\\infty\b/g,         '∞'],
  [/\\alpha\b/g,         'α'],
  [/\\beta\b/g,          'β'],
  [/\\gamma\b/g,         'γ'],
  [/\\delta\b/g,         'δ'],
  [/\\epsilon\b/g,       'ε'],
  [/\\lambda\b/g,        'λ'],
  [/\\mu\b/g,            'μ'],
  [/\\pi\b/g,            'π'],
  [/\\sigma\b/g,         'σ'],
  [/\\tau\b/g,           'τ'],
  [/\\phi\b/g,           'φ'],
  [/\\psi\b/g,           'ψ'],
  [/\\omega\b/g,         'ω'],
]

function preprocessContent(src: string): string {
  // Strip GitBook hint/info/warning/danger blocks
  src = src.replace(/\{%\s*hint\s+style="[^"]*"\s*%\}[\s\S]*?\{%\s*endhint\s*%\}/gi, '')
  src = src.replace(/\{%\s*\w[^%]*%\}/g, '')

  // Replace $...$ inline math: convert known symbols then strip the $ delimiters
  src = src.replace(/\$([^$\n]+?)\$/g, (_match, inner: string) => {
    let result = inner
    for (const [pattern, replacement] of LATEX_SYMBOLS) {
      result = result.replace(pattern, replacement)
    }
    // If we still have backslash commands, strip them gracefully
    result = result.replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
    result = result.replace(/\\[a-zA-Z]+/g, '')
    result = result.replace(/[{}^_]/g, '')
    return result.trim()
  })

  return src
}

// ── Component ─────────────────────────────────────────────────────────────────
interface MDXContentProps {
  source: string
  filePath: string
}

export function MDXContent({ source, filePath }: MDXContentProps) {
  const processed = resolveRelativeLinks(preprocessContent(source), filePath)
  const html = marked.parse(processed, { async: false }) as string

  return (
    <div
      className="tg-prose"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
