import { createContext, useContext } from 'react'

/**
 * The portal's language, provided once by PartnersLayout (which owns the
 * toggle via useLanguage — the same `hasio_lang` key as the landing page, so a
 * visitor who reads the site in English arrives in the portal in English).
 */
export const PartnerLangContext = createContext({ lang: 'ar', isRtl: true, toggleLang: () => {} })

export function usePartnerLang() {
  return useContext(PartnerLangContext)
}

/** `translations[lang]` with English as the fallback for a missing key. */
export function pick(translations, lang) {
  return { ...translations.en, ...(translations[lang] ?? {}) }
}
