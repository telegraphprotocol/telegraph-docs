import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        tg: {
          bg:           'var(--tg-bg)',
          fg:           'var(--tg-fg)',
          'fg-dim':     'var(--tg-fg-dim)',
          'fg-faint':   'var(--tg-fg-faint)',
          line:         'var(--tg-line)',
          'line-soft':  'var(--tg-line-soft)',
          'line-strong':'var(--tg-line-strong)',
          sidebar:      'var(--tg-sidebar)',
          amber:        '#f59e0b',
        },
      },
      fontFamily: {
        sans:  ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono:  ['var(--font-jetbrains)', 'JetBrains Mono', 'monospace'],
        brand: ['var(--font-roboto-mono)', 'Roboto Mono', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      animation: {
        blink:    'blink 1s step-end infinite',
        'fade-up':'fadeUp 0.4s ease forwards',
        'fade-in':'fadeIn 0.3s ease forwards',
      },
      keyframes: {
        blink:  { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0' } },
        fadeUp: { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeIn: { from: { opacity: '0' }, to:   { opacity: '1' } },
      },
    },
  },
  plugins: [typography],
}

export default config
