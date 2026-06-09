import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center animate-[fadeUp_0.4s_ease_forwards]">
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-400 mb-4 font-sans">
          404
        </div>
        <h1 className="text-2xl font-semibold text-tg-fg mb-3 font-sans">
          Page not found
        </h1>
        <p className="text-sm text-tg-fg-faint mb-8 font-sans">
          This page does not exist in the documentation.
        </p>
        <Link
          href="/docs"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-sans bg-white text-black rounded-[70px] hover:bg-tg-fg-dim transition-colors"
        >
          Go to docs
        </Link>
      </div>
    </div>
  )
}
