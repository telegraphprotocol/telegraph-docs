import { NextRequest, NextResponse } from 'next/server'

const nodeURL = 'https://devnode.telegraphprotocol.com'
const intentPattern = /^[A-Z][A-Z0-9_]*$/

export async function GET(request: NextRequest) {
  const intent = request.nextUrl.searchParams.get('intent')
  const path = intent
    ? intentPattern.test(intent)
      ? `/engine/v1/intents/${encodeURIComponent(intent)}`
      : null
    : '/engine/v1/intents'

  if (!path) {
    return NextResponse.json(
      { error: 'intent must use uppercase letters, digits, and underscores' },
      { status: 400 },
    )
  }

  try {
    const upstream = await fetch(`${nodeURL}${path}`, {
      next: { revalidate: 60 },
    })
    const body: unknown = await upstream.json().catch(() => ({ error: 'node returned invalid JSON' }))
    return NextResponse.json(body, { status: upstream.status })
  } catch {
    return NextResponse.json(
      { error: 'the public node could not be reached; try the curl command in the Intents guide' },
      { status: 502 },
    )
  }
}
