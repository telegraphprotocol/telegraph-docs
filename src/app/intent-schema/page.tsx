import type { Metadata } from 'next'
import { IntentSchemaExplorer } from '@/components/IntentSchemaExplorer'
import { DocsLayout } from '@/components/DocsLayout'
import { getNavigation } from '@/lib/docs'

export const metadata: Metadata = {
  title: 'Intent Schema Explorer',
  description: 'Inspect Telegraph intent request, response, and on-chain schemas from the public node.',
}

export default function IntentSchemaPage() {
  return (
    <DocsLayout
      nav={getNavigation()}
      slug={[]}
      headings={[]}
      prevHref={null}
      nextHref={null}
      breadcrumb={{ section: 'Intelligence', current: 'Explore Capabilities & Schemas' }}
    >
      <IntentSchemaExplorer />
    </DocsLayout>
  )
}
