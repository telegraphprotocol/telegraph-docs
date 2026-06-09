'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function HeadingAnchors() {
  const pathname = usePathname()

  useEffect(() => {
    const prose = document.querySelector('.tg-prose')
    if (!prose) return

    const headings = prose.querySelectorAll<HTMLElement>('h2[id], h3[id], h4[id]')

    headings.forEach((heading) => {
      if (heading.querySelector('.heading-anchor')) return

      const id = heading.id
      const a  = document.createElement('a')
      a.href      = `#${id}`
      a.className = 'heading-anchor'
      a.innerHTML = '#'
      a.setAttribute('aria-label', `Link to section: ${heading.textContent}`)

      a.addEventListener('click', (e) => {
        e.preventDefault()
        const url = `${window.location.origin}${pathname}#${id}`
        navigator.clipboard.writeText(url).catch(() => {})
        // Update URL without scroll jump
        history.pushState(null, '', `#${id}`)
        // Smooth scroll
        heading.scrollIntoView({ behavior: 'smooth' })
        // Brief visual feedback
        a.classList.add('heading-anchor--copied')
        setTimeout(() => a.classList.remove('heading-anchor--copied'), 1500)
      })

      // Insert at the start of the heading so it flows left of the text
      heading.style.position = 'relative'
      heading.insertBefore(a, heading.firstChild)
    })
  }, [pathname])

  return null
}
