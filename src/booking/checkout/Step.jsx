import { useId } from 'react'
import { CheckIcon } from './icons'

const translations = {
  en: { step: (n) => `Step ${n}: `, done: ' (done)' },
  ar: { step: (n) => `الخطوة ${n}: `, done: ' (مكتملة)' },
}

/**
 * One numbered step of the checkout. `state` is 'open' (its form shows),
 * 'done' (one line with a check: what was decided, and a way to change it) or
 * 'todo' (a quiet signpost until the steps before it are done). The heading
 * takes `headingRef` and tabIndex -1 so the page can move focus to it the
 * moment the step opens.
 */
export default function Step({ n, title, state, headingRef, summary, lang, children }) {
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const headingId = useId()
  return (
    <section className={`bk-card co-step is-${state}`} aria-labelledby={headingId}>
      <div className="co-step-head">
        <span className="co-step-num" aria-hidden="true">{state === 'done' ? <CheckIcon /> : n}</span>
        <div className="co-step-heading">
          <h2 id={headingId} ref={headingRef} tabIndex={-1} className="co-step-title">
            <span className="bk-sr">{t.step(n)}</span>
            {title}
            {state === 'done' && <span className="bk-sr">{t.done}</span>}
          </h2>
          {state === 'done' && summary ? <div className="co-step-summary">{summary}</div> : null}
        </div>
      </div>
      {state === 'open' ? <div className="co-step-body">{children}</div> : null}
    </section>
  )
}
