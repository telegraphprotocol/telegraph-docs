'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

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
  const [filter, setFilter] = useState('')

  const visibleIntents = useMemo(() => {
    const query = filter.trim().toUpperCase()
    if (!query) return intents
    return intents.filter((item) => (item.intent_name ?? item.intent_id ?? '').includes(query))
  }, [filter, intents])

  useEffect(() => {
    fetch('/api/intent-schema')
      .then(async (response) => {
        if (!response.ok) throw new Error(`Could not load intents (${response.status})`)
        return response.json() as Promise<IntentList>
      })
      .then((data) => setIntents(data.intents ?? []))
      .catch((cause: unknown) => setError(messageFor(cause)))
  }, [])

  async function loadIntent(value: string) {
    const normalized = value.trim().toUpperCase()
    if (!normalized) {
      setError('Enter an intent name.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    try {
      const response = await fetch(`/api/intent-schema?intent=${encodeURIComponent(normalized)}`)
      const body: unknown = await response.json()
      if (!response.ok) {
        const detail = typeof body === 'object' && body !== null && 'error' in body
          ? String(body.error)
          : `Request failed (${response.status})`
        throw new Error(detail)
      }
      setIntent(normalized)
      setResult(body)
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setLoading(false)
    }
  }

  function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadIntent(intent)
  }

  return (
    <main className="min-h-screen bg-[var(--tg-bg)] px-5 py-12 sm:px-8 lg:px-14">
      <div className="mx-auto max-w-4xl">
        <a className="text-sm text-[var(--tg-amber)] underline" href="/docs/using/intents">
          ← Back to Intents
        </a>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-[var(--tg-fg)]">
          Browse Intents & Schemas
        </h1>
        <p className="mt-3 max-w-3xl text-[var(--tg-fg-dim)]">
          Choose a live capability, then use its public request, processed-response, and on-chain
          schemas as your integration contract.
        </p>

        <section className="mt-8 rounded-lg border border-[var(--tg-line)] bg-[var(--tg-bg-subtle)] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--tg-fg)]">Live intent catalog</h2>
              <p className="mt-1 text-sm text-[var(--tg-fg-dim)]">
                {intents.length ? `${intents.length} live intents. Select one to inspect its exact schema.` : 'Loading live intents…'}
              </p>
            </div>
            <input
              aria-label="Filter intents"
              className="w-full rounded-md border border-[var(--tg-line-strong)] bg-[var(--tg-bg)] px-3 py-2 font-mono text-sm text-[var(--tg-fg)] outline-none focus:border-[var(--tg-amber)] sm:w-72"
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter, for example: WEATHER"
              value={filter}
            />
          </div>
          <div className="mt-4 grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {visibleIntents.map((item) => {
              const name = item.intent_name ?? item.intent_id
              if (!name) return null
              return (
                <button
                  className="rounded-md border border-[var(--tg-line)] bg-[var(--tg-bg)] px-3 py-2 text-left transition hover:border-[var(--tg-amber)] hover:bg-[var(--tg-line-soft)]"
                  key={name}
                  onClick={() => void loadIntent(name)}
                  type="button"
                >
                  <span className="block font-mono text-sm font-medium text-[var(--tg-fg)]">{name}</span>
                  <span className="mt-1 block text-xs text-[var(--tg-fg-dim)]">{item.miner_count ?? 0} miners</span>
                </button>
              )
            })}
          </div>
        </section>

        <form className="mt-8 flex flex-col gap-3 sm:flex-row" onSubmit={load}>
          <input
            aria-label="Intent name"
            className="min-w-0 flex-1 rounded-md border border-[var(--tg-line-strong)] bg-[var(--tg-bg)] px-3 py-2 font-mono text-sm text-[var(--tg-fg)] outline-none focus:border-[var(--tg-amber)]"
            list="intent-names"
            onChange={(event) => setIntent(event.target.value)}
            placeholder="Or type an exact intent name"
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
            <h2 className="text-xl font-semibold text-[var(--tg-fg)]">Live integration schema</h2>
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
