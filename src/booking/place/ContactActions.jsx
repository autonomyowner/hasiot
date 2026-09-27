import { directionsUrl, mailHref, telHref, websiteHref } from '../links'

const translations = {
  en: { call: 'Call', email: 'Email', directions: 'Directions', website: 'Website' },
  ar: { call: 'اتصال', email: 'بريد إلكتروني', directions: 'الاتجاهات', website: 'الموقع الإلكتروني' },
}

const icon = (d) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)
const ICONS = {
  call: icon(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />),
  email: icon(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>),
  directions: icon(<><path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></>),
  website: icon(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>),
}

/**
 * The ways to reach a place or a provider: call, email, directions, website.
 * Each appears only when there is something real to open (links.js checks
 * every value a host typed), so a page never offers a dead button.
 */
export default function ContactActions({ phone, email, website, coordinates, address, lang, callLabel }) {
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const items = [
    { key: 'call', href: telHref(phone), label: callLabel ?? t.call },
    { key: 'email', href: mailHref(email), label: t.email },
    { key: 'directions', href: directionsUrl({ coordinates, address }), label: t.directions, external: true },
    { key: 'website', href: websiteHref(website), label: t.website, external: true },
  ].filter((item) => item.href)

  if (items.length === 0) return null
  return (
    <div className="bk-actions">
      {items.map((item) => (
        <a
          key={item.key}
          className="bk-action"
          href={item.href}
          {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {ICONS[item.key]}
          <span>{item.label}</span>
        </a>
      ))}
    </div>
  )
}
