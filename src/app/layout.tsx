import type { Metadata } from 'next'
import { Inter, JetBrains_Mono, Roboto_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
})

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
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
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: 'Telegraph Docs',
    description:
      'Telegraph Protocol Documentation — A permissionless messaging protocol that commoditizes AI inference and delivers intelligent signals to global markets on-chain.',
    url: 'https://docs.telegraphprotocol.com',
    siteName: 'Telegraph Docs',
    images: [
      {
        url: '/telegraph-social-card.jpg',
        width: 1200,
        height: 630,
        alt: 'Telegraph Protocol',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Telegraph Docs',
    description:
      'Telegraph Protocol Documentation — A permissionless messaging protocol that commoditizes AI inference and delivers intelligent signals to global markets on-chain.',
    images: ['/telegraph-social-card.jpg'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${robotoMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
