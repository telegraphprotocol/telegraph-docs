import type { Metadata } from 'next'
import { Roboto_Mono } from 'next/font/google'
import './globals.css'

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-roboto-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Telegraph Docs',
    template: '%s — Telegraph Docs',
  },
  description:
    'Telegraph Protocol Documentation — A permissionless messaging protocol that commoditizes AI inference and delivers intelligent signals to global markets on-chain.',
  metadataBase: new URL('https://docs.telegraphprotocol.com'),
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${robotoMono.variable} font-mono bg-black text-tg-fg antialiased`}>
        {children}
      </body>
    </html>
  )
}
