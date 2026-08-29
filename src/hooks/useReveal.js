import { useEffect } from 'react'

/**
 * Fades sections in as they scroll into view.
 *
 * This replaces framer-motion, which cost 127 kB to do nothing but this on a
 * page that is otherwise static. Elements opt in with `data-reveal`; the hook
 * marks the document first so the hidden start state only applies once JS is
 * running — without that, a failed bundle would leave the page blank.
 */
export function useReveal() {
  useEffect(() => {
    const root = document.documentElement
    const nodes = document.querySelectorAll('[data-reveal]')
    if (!nodes.length) return

    // No IntersectionObserver, or the visitor asked for less motion: show
    // everything immediately rather than animating it.
    const still = !('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (still) {
      nodes.forEach((n) => n.classList.add('is-in'))
      return
    }

    root.classList.add('reveal-ready')
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        e.target.classList.add('is-in')
        io.unobserve(e.target)
      })
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' })

    nodes.forEach((n) => io.observe(n))
    return () => {
      io.disconnect()
      root.classList.remove('reveal-ready')
    }
  }, [])
}
