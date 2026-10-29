import type { Metadata } from 'next'
import { IntentSchemaExplorer } from '@/components/IntentSchemaExplorer'

export const metadata: Metadata = {
  title: 'Intent Schema Explorer',
  description: 'Inspect Telegraph intent request, response, and on-chain schemas from the public node.',
}

export default function IntentSchemaPage() {
  return <IntentSchemaExplorer />
}
