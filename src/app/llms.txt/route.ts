import { llmsIndex } from '@/lib/llms'

// /llms.txt: an index of every page with a one-line description, in the
// format AI tools look for (https://llmstxt.org).
export const dynamic = 'force-static'

export function GET() {
  return new Response(llmsIndex(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
