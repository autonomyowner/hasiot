import { useEffect } from 'react'

/**
 * Fades sections in as they scroll into view.
 *
 * This replaces framer-motion, which cost 127 kB to do nothing but this on a
 * page that is otherwise static. Elements opt in with `data-reveal`; the hook
 * marks the document first so the hidden start state only applies once JS is
 * running — without that, a failed bundle would leave the page blank.
 *
 * Pass anything that swaps the marked-up nodes as `dep` — the landing page
 * keys its lists by translated strings, so toggling the language unmounts every
 * revealed element and mounts brand-new ones. Without a re-scan those new nodes
 * are never observed and stay at opacity 0 forever.
 *
 * `dep` alone is not enough, though: the page's lazy sections resolve their
 * chunks *after* this effect has run, so a node inside one of them misses the
 * scan and is hidden permanently — the exact failure, with no error to point at
 * it. A MutationObserver therefore re-scans whenever nodes are added, which is
 * what makes it safe to put `data-reveal` inside a <Suspense> boundary at all.
 */
export function useReveal(dep) {
  useEffect(() => {
    const root = document.documentElement

    // No IntersectionObserver, or the visitor asked for less motion: show
    // everything immediately rather than animating it.
    const still = !('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const all = () => document.querySelectorAll('[data-reveal]')

    if (still) {
      const showAll = () => all().forEach((n) => n.classList.add('is-in'))
      showAll()
      const mo = new MutationObserver(showAll)
      mo.observe(document.body, { childList: true, subtree: true })
      return () => mo.disconnect()
    }

    root.classList.add('reveal-ready')
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        e.target.classList.add('is-in')
        io.unobserve(e.target)
      })
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' })

    // Already-revealed nodes keep their class, so a re-scan never re-hides
    // anything the visitor has scrolled past. Re-observing a node already under
    // this observer is a no-op, so scan() is safe to call as often as it likes.
    const scan = () => all().forEach((n) => {
      if (!n.classList.contains('is-in')) io.observe(n)
    })
    scan()
    const mo = new MutationObserver(scan)
    mo.observe(document.body, { childList: true, subtree: true })

    return () => {
      mo.disconnect()
      io.disconnect()
      root.classList.remove('reveal-ready')
    }
  }, [dep])
}
