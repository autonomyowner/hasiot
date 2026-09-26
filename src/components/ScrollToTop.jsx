import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * A new page starts at its top.
 *
 * The router keeps the window where it was between pages, so a place opened
 * from far down /explore would open scrolled to its reviews. Only a change of
 * path counts: a booking page rewrites its own query string on every date
 * pick, and that must never jump the page. Back and forward are left to the
 * browser, which restores where the visitor was; a link to a #section is left
 * to the browser too.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const type = useNavigationType()
  const previous = useRef(pathname)

  useLayoutEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    // 'instant', not the default: App.css sets smooth scrolling on <html>, and
    // a new page must not glide up from where the last one was left.
    if (type !== 'POP' && !hash) window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, hash, type])

  return null
}
