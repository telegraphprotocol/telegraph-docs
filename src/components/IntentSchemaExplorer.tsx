'use client'

import { FormEvent, useEffect, useState } from 'react'

type IntentSummary = {
  intent_name?: string
  intent_id?: string
  miner_count?: number
}

type IntentList = { intents?: IntentSummary[] }

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : 'Request failed'
}

export function IntentSchemaExplorer() {
  const [intent, setIntent] = useState('')
  const [intents, setIntents] = useState<IntentSummary[]>([])
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/intent-schema')
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not load intents (${response.status})`)
        return response.json() as Promise<IntentList>
      })
      .then((data) => setIntents(data.intents ?? []))
      .catch((cause: unknown) => setError(messageFor(cause)))
  }, [])

  async function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = intent.trim().toUpperCase()
    if (!value) {
      setError('Enter an intent name.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    try {
      const response = await fetch(`/api/intent-schema?intent=${encodeURIComponent(value)}`)
      const body: unknown = await response.json()
      if (!response.ok) {
        const detail = typeof body === 'object' && body !== null && 'error' in body
          ? String(body.error)
          : `Request failed (${response.status})`
        throw new Error(detail)
      }
      setIntent(value)
      setResult(body)
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[var(--tg-bg)] px-5 py-12 sm:px-8 lg:px-14">
      <div className="mx-auto max-w-4xl">
        <a className="text-sm text-[var(--tg-amber)] underline" href="/docs/using/intents">
          ← Back to Intents
        </a>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-[var(--tg-fg)]">
          Intent Schema Explorer
        </h1>
        <p className="mt-3 max-w-3xl text-[var(--tg-fg-dim)]">
          Read the public node&apos;s current canonical request schema, processed response schema,
          and on-chain request and response layouts. Use the returned schema as the integration contract.
        </p>

        <form className="mt-8 flex flex-col gap-3 sm:flex-row" onSubmit={load}>
          <input
            aria-label="Intent name"
            className="min-w-0 flex-1 rounded-md border border-[var(--tg-line-strong)] bg-[var(--tg-bg)] px-3 py-2 font-mono text-sm text-[var(--tg-fg)] outline-none focus:border-[var(--tg-amber)]"
            list="intent-names"
            onChange={(event) => setIntent(event.target.value)}
            placeholder="For example: FX_NOW_EUR"
            value={intent}
          />
          <datalist id="intent-names">
            {intents.map((item) => {
              const name = item.intent_name ?? item.intent_id
              return name ? <option key={name} value={name} /> : null
            })}
          </datalist>
          <button
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Loading…' : 'Load schema'}
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        {result !== null && (
          <section className="mt-8">
            <h2 className="text-xl font-semibold text-[var(--tg-fg)]">Live schema</h2>
            <p className="mt-2 text-sm text-[var(--tg-fg-dim)]">
              This is the node response used by consumers. Keep the relevant schema version with your integration.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-lg border border-[var(--tg-line)] bg-[var(--tg-code-bg)] p-4 text-xs leading-6 text-[var(--tg-code-fg)]">
              {JSON.stringify(result, null, 2)}
            </pre>
          </section>
        )}
      </div>
    </main>
  )
}
