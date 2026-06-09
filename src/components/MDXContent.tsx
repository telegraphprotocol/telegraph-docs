import { marked } from 'marked'
import hljs from 'highlight.js'
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

// ── Component ─────────────────────────────────────────────────────────────────
interface MDXContentProps {
  source: string
}

export function MDXContent({ source }: MDXContentProps) {
  const html = marked.parse(source, { async: false }) as string

  return (
    <div
      className="tg-prose"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
