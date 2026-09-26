import { usePartnerLang, pick } from '../lang'
import { Icon } from './Ui'

const translations = {
  en: {
    stepsLabel: 'Sign-up progress',
    steps: ['Account', 'Your business', 'Documents'],
    stepOf: 'Step {n} of 3',
    done: 'done',
    current: 'current',
  },
  ar: {
    stepsLabel: 'مراحل التسجيل',
    steps: ['الحساب', 'نشاطك', 'المستندات'],
    stepOf: 'الخطوة {n} من 3',
    done: 'مكتملة',
    current: 'الحالية',
  },
}

// The landing page's two brand posters (its "inside the app" section). They
// are artwork with their own typography, so they are always shown whole —
// never cropped with object-fit: cover, and nothing is laid over them.
const POSTERS = [
  { src: '/posters/gate.webp', w: 1085, h: 1335 },
  { src: '/posters/arch.webp', w: 1122, h: 1402 },
]

/**
 * The frame for every screen a partner sees before approval (sign in, join,
 * documents, suspended). On wide screens the form sits between the two
 * posters; under 1100px it is the slim header and the form alone. The poster
 * columns are display:none there and the images are lazy, which Chrome and
 * Safari do not fetch while hidden, so a phone does not download them.
 * The header (brand, language, sign out) is passed in by the layout so the
 * controls stay the ones the rest of the portal uses.
 */
export default function AuthShell({ header, children }) {
  const poster = (p) => (
    <aside className="p-auth-panel" aria-hidden="true">
      <figure className="p-auth-poster">
        <img src={p.src} alt="" width={p.w} height={p.h} loading="lazy" decoding="async" />
      </figure>
    </aside>
  )
  return (
    <div className="p-auth">
      {poster(POSTERS[0])}
      <div className="p-auth-side">
        {header}
        <div className="p-auth-body">
          <div className="p-auth-form">{children}</div>
        </div>
      </div>
      {poster(POSTERS[1])}
    </div>
  )
}

/** The three sign-up steps; `current` is 1-based. */
export function AuthSteps({ current }) {
  const { lang } = usePartnerLang()
  const t = pick(translations, lang)
  return (
    <nav className="p-steps" aria-label={t.stepsLabel}>
      <p className="p-steps-count">{t.stepOf.replace('{n}', String(current))}</p>
      <ol className="p-steps-list">
        {t.steps.map((label, i) => {
          const n = i + 1
          const state = n < current ? 'is-done' : n === current ? 'is-current' : ''
          return (
            <li key={label} className={`p-step ${state}`} aria-current={n === current ? 'step' : undefined}>
              <span className="p-step-dot" aria-hidden="true">
                {n < current ? <Icon name="check" size={14} /> : n}
              </span>
              <span className="p-step-label">
                {label}
                {n < current && <span className="p-visually-hidden"> ({t.done})</span>}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
