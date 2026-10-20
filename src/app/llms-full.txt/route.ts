import { llmsFull } from '@/lib/llms'

// /llms-full.txt: the whole documentation as one Markdown file, for pasting
// into an AI chat or loading into an agent's context.
export const dynamic = 'force-static'

export function GET() {
  return new Response(llmsFull(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
