'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

type IntentSummary = {
  intent_name?: string
  intent_id?: string
  miner_count?: number
}

type IntentList = { intents?: IntentSummary[] }

type SchemaItem = {
  name?: string
  type?: string
  required?: boolean
  description?: string
  unit?: string
  examples?: unknown[]
  default?: unknown
}

const NODE = 'https://devnode.telegraphprotocol.com'

function itemsAt(value: unknown, part: 'request' | 'response'): SchemaItem[] {
  if (typeof value !== 'object' || value === null) return []
  const section = (value as Record<string, unknown>)[part]
  if (typeof section !== 'object' || section === null) return []
  const list = (section as Record<string, unknown>)[part === 'request' ? 'params' : 'fields']
  return Array.isArray(list) ? (list as SchemaItem[]) : []
}

function minerCount(value: unknown): number | null {
  if (typeof value !== 'object' || value === null) return null
  const count = (value as Record<string, unknown>).miner_count
  return typeof count === 'number' ? count : null
}

// This may contain placeholders when the schema has no public example or default.
function exampleRequest(name: string, params: SchemaItem[]): string {
  const body: Record<string, unknown> = {}
  for (const param of params) {
    if (!param.name || !param.required) continue
    body[param.name] = param.examples?.[0] ?? param.default ?? `<${param.name}>`
  }
  const json = JSON.stringify({ intent: name, params: body })
  return `curl -X POST ${NODE}/engine/v1/ask \\\n  -H "Content-Type: application/json" \\\n  -d '${json}'`
}

function hasCompleteExample(params: SchemaItem[]): boolean {
  return params
    .filter((param) => param.name && param.required)
    .every((param) => param.examples?.[0] !== undefined || param.default !== undefined)
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : 'Request failed'
}

function hasConsumptionSchema(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const intent = value as Record<string, unknown>
  return typeof intent.request === 'object' && intent.request !== null &&
    typeof intent.response === 'object' && intent.response !== null
}

export function IntentSchemaExplorer() {
  const [intent, setIntent] = useState('')
  const [intents, setIntents] = useState<IntentSummary[]>([])
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const requestParams = result && typeof result === 'object' ? itemsAt(result, 'request') : []

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
    <div className="w-full max-w-4xl">
        <div className="mb-8 border-b border-[var(--tg-line)] pb-7">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--tg-amber)]">
            Live catalog
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--tg-fg)] sm:text-4xl">
            Explore capabilities and schemas
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[var(--tg-fg-dim)]">
            Find a live capability, inspect its exact request and processed-result schema, then build against that contract.
          </p>
        </div>

        <section className="rounded-xl border border-[var(--tg-line)] bg-[var(--tg-bg-subtle)] p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-[var(--tg-fg)]">Intents</h2>
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
          <div className="mt-5 grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {visibleIntents.map((item) => {
              const name = item.intent_name ?? item.intent_id
              if (!name) return null
              return (
                <button
                  className="rounded-lg border border-[var(--tg-line)] bg-[var(--tg-bg)] px-3.5 py-3 text-left transition hover:border-amber-500/70 hover:bg-[var(--tg-line-soft)] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  key={name}
                  onClick={() => void loadIntent(name)}
                  type="button"
                >
                  <span className="block font-mono text-sm font-medium text-[var(--tg-fg)]">{name}</span>
                  <span className="mt-1 block text-xs text-[var(--tg-fg-faint)]">{item.miner_count ?? 0} miners available</span>
                </button>
              )
            })}
          </div>
        </section>

        <form className="mt-5 flex flex-col gap-3 border-t border-[var(--tg-line)] pt-5 sm:flex-row" onSubmit={load}>
          <input
            aria-label="Intent name"
            className="min-w-0 flex-1 rounded-md border border-[var(--tg-line-strong)] bg-[var(--tg-bg)] px-3 py-2 font-mono text-sm text-[var(--tg-fg)] outline-none focus:border-[var(--tg-amber)]"
            list="intent-names"
            onChange={(event) => setIntent(event.target.value)}
            placeholder="Enter an exact intent name"
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
            {loading ? 'Loading…' : 'Inspect schema'}
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        {result !== null && (
          <section className="mt-8">
            <h2 className="text-xl font-semibold tracking-tight text-[var(--tg-fg)]">Integration contract</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--tg-fg-dim)]">
              This is the live node response. Keep the relevant schema version with your integration.
            </p>
            {!hasConsumptionSchema(result) && (
              <p className="mt-3 rounded-lg border border-[var(--tg-line)] bg-[var(--tg-bg-subtle)] px-3 py-2 text-sm text-[var(--tg-fg-dim)]">
                This intent has no published request and result schema yet. Ask the Telegraph team in Discord and include its exact name.
              </p>
            )}
            {minerCount(result) === 0 && (
              <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-[var(--tg-fg)]">
                No miner serves this intent right now, so a request for it is refused with <code>no_compatible_miner</code>. Pick an intent with miners.
              </p>
            )}
            <SchemaTable title="Request params" items={requestParams} showRequired />
            <SchemaTable title="Result fields" items={itemsAt(result, 'response')} />
            {requestParams.length > 0 && (
              <>
                <h3 className="mt-6 text-base font-semibold text-[var(--tg-fg)]">Try it</h3>
                <p className="mt-1 text-sm text-[var(--tg-fg-dim)]">
                  {hasCompleteExample(requestParams)
                    ? <>This command uses examples or defaults published by the schema. Without a payment it returns <code>402 Payment Required</code> with the price; that is expected.</>
                    : <>Replace each <code>&lt;placeholder&gt;</code> with a valid value from the schema before sending this request. Without a payment it returns <code>402 Payment Required</code> with the price.</>}{' '}
                  See <a className="underline" href="/docs/using/consume-intelligence">Start Using Intelligence</a> for payment.
                </p>
                <pre className="mt-2 overflow-x-auto rounded-lg border border-[var(--tg-line)] bg-[var(--tg-code-bg)] p-4 text-xs leading-6 text-[var(--tg-code-fg)]">
                  {exampleRequest(String((result as Record<string, unknown>).intent_id ?? intent), requestParams)}
                </pre>
              </>
            )}
            <details className="mt-6">
              <summary className="cursor-pointer text-sm font-medium text-[var(--tg-fg)]">Full schema (JSON)</summary>
              <pre className="mt-3 overflow-x-auto rounded-lg border border-[var(--tg-line)] bg-[var(--tg-code-bg)] p-4 text-xs leading-6 text-[var(--tg-code-fg)]">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </section>
        )}
    </div>
  )
}

function SchemaTable({ title, items, showRequired = false }: { title: string; items: SchemaItem[]; showRequired?: boolean }) {
  if (items.length === 0) return null
  return (
    <>
      <h3 className="mt-6 text-base font-semibold text-[var(--tg-fg)]">{title}</h3>
      <div className="mt-2 overflow-x-auto rounded-lg border border-[var(--tg-line)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--tg-bg-subtle)] text-[var(--tg-fg-dim)]">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Type</th>
              {showRequired ? <th className="px-3 py-2 font-medium">Required</th> : <th className="px-3 py-2 font-medium">Unit</th>}
              <th className="px-3 py-2 font-medium">Meaning</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr className="border-t border-[var(--tg-line)]" key={item.name ?? index}>
                <td className="px-3 py-2 font-mono text-[var(--tg-fg)]">{item.name}</td>
                <td className="px-3 py-2 text-[var(--tg-fg-dim)]">{item.type}</td>
                <td className="px-3 py-2 text-[var(--tg-fg-dim)]">{showRequired ? (item.required ? 'yes' : 'no') : (item.unit ?? '')}</td>
                <td className="px-3 py-2 text-[var(--tg-fg-dim)]">{item.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
