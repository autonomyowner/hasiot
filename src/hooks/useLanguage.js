import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'hasio_lang'
const DEFAULT_LANG = 'ar'

function readStoredLang() {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG
  } catch {
    // Private browsing / storage disabled
    return DEFAULT_LANG
  }
}

/**
 * Single source of truth for the AR/EN toggle.
 *
 * Pages used to each keep their own `useState` and set `dir` on their own root
 * div, which meant every `html[dir="rtl"]` rule (Arabic fonts, nav mirroring)
 * never fired. This sets `dir`/`lang` on <html> so those rules apply, and
 * persists the choice so it survives navigation between pages.
 */
/**
 * Push `dir`/`lang` onto <html> for screens whose language comes from somewhere
 * other than the toggle — the dashboards read it off the user's saved
 * `preferredLanguage`. Without this they render LTR-styled Arabic.
 */
export function useSyncHtmlLang(lang) {
  useEffect(() => {
    if (!lang) return
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
  }, [lang])
}

export function useLanguage() {
  const [lang, setLangState] = useState(readStoredLang)

  useEffect(() => {
    const isRtl = lang === 'ar'
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // Ignore — the in-memory value still drives this session
    }
  }, [lang])

  // Keep tabs in sync when the language changes in another one.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) setLangState(e.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setLang = useCallback((next) => setLangState(next), [])
  const toggleLang = useCallback(
    () => setLangState((prev) => (prev === 'ar' ? 'en' : 'ar')),
    []
  )

  return { lang, setLang, toggleLang, isRtl: lang === 'ar' }
}

export default useLanguage
