'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`

export function CodeCopyButtons() {
  const pathname = usePathname()

  useEffect(() => {
    const blocks = document.querySelectorAll<HTMLElement>('.code-block')

    blocks.forEach((block) => {
      // Find or create header
      let header = block.querySelector<HTMLElement>('.code-block-header')
      if (!header) return // header is rendered by MDXContent

      if (header.querySelector('.copy-btn')) return // already injected

      const btn = document.createElement('button')
      btn.className = 'copy-btn'
      btn.innerHTML = COPY_SVG
      btn.title = 'Copy code'

      btn.addEventListener('click', async () => {
        const code = block.querySelector('code')?.textContent ?? ''
        try {
          await navigator.clipboard.writeText(code)
          btn.innerHTML = CHECK_SVG
          btn.classList.add('copy-btn--success')
          setTimeout(() => {
            btn.innerHTML = COPY_SVG
            btn.classList.remove('copy-btn--success')
          }, 2000)
        } catch {
          // clipboard not available
        }
      })

      header.appendChild(btn)
    })
  }, [pathname])

  return null
}
