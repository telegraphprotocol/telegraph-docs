import { ImageResponse } from 'next/og'

export const runtime     = 'nodejs'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%',
          background: '#0a0a0a',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          fontFamily: 'monospace',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(245,158,11,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />

        {/* Amber glow */}
        <div style={{
          position: 'absolute', top: -120, right: -80,
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)',
        }} />

        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 600 }}>Telegraph</span>
          <div style={{
            padding: '3px 10px', borderRadius: 6,
            border: '1px solid rgba(245,158,11,0.3)',
            background: 'rgba(245,158,11,0.08)',
            color: '#f59e0b', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>Docs</div>
        </div>

        {/* Center */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Documentation
          </div>
          <div style={{ color: '#f1f5f9', fontSize: 64, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Telegraph Protocol
          </div>
          <div style={{ color: '#64748b', fontSize: 22, lineHeight: 1.5, maxWidth: 700 }}>
            A permissionless messaging protocol that commoditizes AI inference and delivers intelligent signals on-chain.
          </div>
        </div>

        {/* Bottom */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 24,
        }}>
          <span style={{ color: '#64748b', fontSize: 14 }}>docs.telegraphprotocol.com</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 13 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
            Telegraph Protocol
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
