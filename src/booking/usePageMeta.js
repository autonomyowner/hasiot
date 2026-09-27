import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * The page's title, and the address search engines and link previews should
 * credit it to (design W23).
 *
 * index.html carries one canonical URL for the whole single-page site, which
 * would make every place page declare itself a copy of the home page. This
 * points `canonical` and `og:url` at this page on hasio.net (never www, never
 * the query string, which only carries a visitor's dates) and puts all three
 * back when the page is left, so /explore does not keep a hotel's title.
 */
export function usePageMeta({ title }) {
  const { pathname } = useLocation()
  useEffect(() => {
    const canonical = document.querySelector('link[rel="canonical"]')
    const ogUrl = document.querySelector('meta[property="og:url"]')
    const before = {
      title: document.title,
      canonical: canonical?.getAttribute('href'),
      ogUrl: ogUrl?.getAttribute('content'),
    }
    const url = `https://hasio.net${pathname}`
    if (title) document.title = `${title} · Hasio`
    canonical?.setAttribute('href', url)
    ogUrl?.setAttribute('content', url)
    return () => {
      document.title = before.title
      if (before.canonical != null) canonical.setAttribute('href', before.canonical)
      if (before.ogUrl != null) ogUrl.setAttribute('content', before.ogUrl)
    }
  }, [title, pathname])
}

export default usePageMeta
