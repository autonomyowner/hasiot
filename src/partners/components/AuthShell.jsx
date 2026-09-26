import { usePartnerLang, pick } from '../lang'
import { Icon } from './Ui'

const translations = {
  en: {
    headline: 'Bring your place to travellers across Saudi Arabia',
    values: [
      { icon: 'map', text: 'Reach travellers planning their trip in the Hasio app.' },
      { icon: 'inbox', text: 'Answer every booking request from one inbox.' },
      { icon: 'chart', text: "See what's working with analytics and a guest list." },
    ],
    stepsLabel: 'Sign-up progress',
    steps: ['Account', 'Your business', 'Documents'],
    stepOf: 'Step {n} of 3',
    done: 'done',
    current: 'current',
  },
  ar: {
    headline: 'قدّم منشأتك للمسافرين في أنحاء السعودية',
    values: [
      { icon: 'map', text: 'اوصل إلى المسافرين وهم يخططون لرحلاتهم في تطبيق Hasio.' },
      { icon: 'inbox', text: 'ردّ على كل طلبات الحجز من صندوق واحد.' },
      { icon: 'chart', text: 'اعرف ما ينجح عندك من خلال التحليلات وقائمة الضيوف.' },
    ],
    stepsLabel: 'مراحل التسجيل',
    steps: ['الحساب', 'نشاطك', 'المستندات'],
    stepOf: 'الخطوة {n} من 3',
    done: 'مكتملة',
    current: 'الحالية',
  },
}

/**
 * The frame for every screen a partner sees before approval (sign in, join,
 * documents, suspended). On wide screens a brand panel sits beside the form;
 * the photo is a CSS background inside a ≥960px media query, so a phone never
 * downloads it. Under 960px it is the slim header and the form alone.
 * The header (brand, language, sign out) is passed in by the layout so the
 * controls stay the ones the rest of the portal uses.
 */
export default function AuthShell({ header, children }) {
  const { lang } = usePartnerLang()
  const t = pick(translations, lang)
  return (
    <div className="p-auth">
      <aside className="p-auth-panel">
        <div className="p-auth-panel-inner">
          <p className="p-auth-brand">
            <span className="p-wordmark" lang="en" dir="ltr">Hasio</span>
            <span className="p-auth-brand-sub">{lang === 'ar' ? 'الشركاء' : 'Partners'}</span>
          </p>
          <div className="p-auth-pitch">
            <h2 className="p-auth-headline">{t.headline}</h2>
            <ul className="p-auth-values">
              {t.values.map((v) => (
                <li key={v.icon}>
                  <span className="p-auth-value-icon"><Icon name={v.icon} size={18} /></span>
                  <span>{v.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
      <div className="p-auth-side">
        {header}
        <div className="p-auth-body">
          <div className="p-auth-form">{children}</div>
        </div>
      </div>
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
