import { getAllSlugs } from '@/lib/docs'
import { pageMarkdown } from '@/lib/llms'

// One page as raw Markdown. Reached as /docs/<page>.md through the rewrite in
// next.config.mjs; /docs/index.md is the docs root.
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug: slug.length === 0 ? ['index'] : slug }))
}

export function GET(_req: Request, { params }: { params: { slug: string[] } }) {
  const slug = params.slug.length === 1 && params.slug[0] === 'index' ? [] : params.slug
  const md   = pageMarkdown(slug)
  if (!md) return new Response('Not found\n', { status: 404 })
  return new Response(md, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  })
}
