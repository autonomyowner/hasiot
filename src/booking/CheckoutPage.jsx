import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import { useLanguage } from '../hooks/useLanguage'
import { useQuerySafe } from '../lib/useQuerySafe'
import { formatPhone } from '../partners/lib/phone'
import PageShell from './PageShell'
import { readAuthReturn } from './authReturn'
import { bookingErrorText, serverText } from './errors'
import { usePageMeta } from './usePageMeta'
import { accountLabel, displayName, needsName } from './checkout/account'
import { choiceQuery, itemPath, quoteArgs, quoteState, readChoice } from './checkout/choice'
import { returnTarget } from './checkout/returnUrl'
import { useSignOut } from './checkout/useSignOut'
import { useSteadyViewer } from './checkout/useSteadyViewer'
import NameStep from './checkout/NameStep'
import PhonePanel from './checkout/PhonePanel'
import SendStep from './checkout/SendStep'
import SignInPanel from './checkout/SignInPanel'
import Step from './checkout/Step'
import Summary from './checkout/Summary'
import SuspendedNotice from './checkout/SuspendedNotice'
import { BackIcon, CheckIcon } from './checkout/icons'
import './checkout/checkout.css'

const translations = {
  en: {
    title: 'Request to book',
    back: { stay: 'Back to the place', service: 'Back to the service' },
    badChoice: { stay: "Those dates can't be booked.", service: "That day or time can't be booked." },
    change: { stay: 'Change dates', service: 'Change day or time' },
    unavailable: { stay: "This place isn't taking bookings right now.", service: "This service isn't available right now." },
    explore: 'Back to Explore',
    loading: 'Loading…',
    stepSignIn: 'Sign in',
    stepDetails: 'Your details',
    stepSend: 'Send your request',
    signedInAs: 'Signed in as',
    signedIn: 'Signed in',
    notYou: 'Not you?',
    signOut: 'Sign out',
    notConfirmed: 'not confirmed by SMS',
    changeNumber: 'Change',
    changeNumberLabel: 'Change your phone number',
  },
  ar: {
    title: 'طلب الحجز',
    back: { stay: 'العودة إلى المكان', service: 'العودة إلى الخدمة' },
    badChoice: { stay: 'لا يمكن حجز هذه التواريخ.', service: 'لا يمكن حجز هذا اليوم أو الوقت.' },
    change: { stay: 'تغيير التواريخ', service: 'تغيير اليوم أو الوقت' },
    unavailable: { stay: 'هذا المكان لا يستقبل الحجوزات حاليًا.', service: 'هذه الخدمة غير متاحة حاليًا.' },
    explore: 'العودة إلى الاستكشاف',
    loading: 'جارٍ التحميل…',
    stepSignIn: 'تسجيل الدخول',
    stepDetails: 'بياناتك',
    stepSend: 'أرسل طلبك',
    signedInAs: 'مسجّل باسم',
    signedIn: 'تم تسجيل الدخول',
    notYou: 'لست أنت؟',
    signOut: 'تسجيل الخروج',
    notConfirmed: 'غير موثّق برسالة',
    changeNumber: 'تغيير',
    changeNumberLabel: 'تغيير رقم جوالك',
  },
}

function Message({ text, children }) {
  return (
    <div className="bk-card co-message">
      <p className="co-message-text">{text}</p>
      {children}
    </div>
  )
}

function StepsSkeleton({ label }) {
  return (
    <div className="bk-card co-skel" aria-busy="true" aria-label={label}>
      <div className="bk-skel co-skel-title" />
      <div className="bk-skel co-skel-block" />
      <div className="bk-skel co-skel-line is-short" />
    </div>
  )
}

/**
 * The checkout: /book/stay/:listingId?checkIn=&checkOut=&guests= and
 * /book/service/:serviceId?date=&time=&quantity=&people= (design W4). The
 * choice lives in the URL, so a Google sign-in, a reload or a shared link
 * comes back to the same request.
 *
 * Beside a summary of what is asked for, three steps: sign in; your details
 * (a name when the account has none — W6 — and the phone the server's
 * `canBook` asks for — W5); send the request. Each opens once the one before
 * is done, and focus moves to it, so a keyboard or screen-reader user is
 * taken along. Everything is read live from Convex: the name, the phone and
 * the quote flip the steps as they change, whoever changes them.
 *
 * Anything read from the URL goes through useQuerySafe: a link cut short by
 * a mail client makes Convex refuse the id, which must read as "not taking
 * bookings", never the error screen (W24).
 */
export default function CheckoutPage({ kind }) {
  const { lang, toggleLang, isRtl } = useLanguage()
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const who = kind === 'service' ? 'service' : 'stay'
  const params = useParams()
  const location = useLocation()
  const id = who === 'service' ? params.serviceId : params.listingId
  const choice = readChoice(who, location.search)
  usePageMeta({ title: t.title })

  // Google's answer, read once: a failure is said under its button in step 1,
  // then dropped from the address (the router's location keeps it, which is
  // why returnTarget strips it again).
  const [googleFailed, setGoogleFailed] = useState(() => readAuthReturn(window.location.search).kind === 'failed')
  useEffect(() => {
    const { kind: returned, search } = readAuthReturn(window.location.search)
    if (returned === null) return
    const { pathname, hash } = window.location
    window.history.replaceState(window.history.state, '', `${pathname}${search}${hash}`)
  }, [])

  // Steady: returning to the tab refetches the session, which must not
  // unmount a half-finished sign-in (checkout/steady.js).
  const viewer = useSteadyViewer()
  const listing = useQuerySafe(api.listings.queries.getListing, who === 'stay' && id ? { listingId: id } : 'skip')
  const service = useQuerySafe(api.services.queries.getService, who === 'service' && id ? { serviceId: id } : 'skip')
  const item = who === 'service' ? service : listing
  const args = quoteArgs(who, id, choice)
  const stayQuote = useQuerySafe(api.bookings.queries.quoteStay, who === 'stay' ? args : 'skip')
  const serviceQuote = useQuerySafe(api.bookings.queries.quoteService, who === 'service' ? args : 'skip')
  const quote = quoteState(who === 'service' ? serviceQuote : stayQuote)
  // Keyed on the text: a failed query hands back a new Error on every render,
  // and the mapping logs anything internal once per change, not per render.
  const reason = quote.status === 'refused' ? serverText(quote.reason) : null
  const quoteText = useMemo(() => (reason === null ? '' : bookingErrorText(reason, lang, who)), [reason, lang, who])

  const [notes, setNotes] = useState('')
  // null, 'edit' (changing an unconfirmed number) or 'required' (the server
  // asked for a phone the page thought was there).
  const [phoneOverride, setPhoneOverride] = useState(null)
  // The server said the session is gone although the client still has one.
  const [reauth, setReauth] = useState(false)
  // A refusal that sent the traveller back a step, said in that step.
  const [notice, setNotice] = useState(null)
  const { signOut, signingOut } = useSignOut()

  const user = viewer.user
  const signedIn = viewer.state === 'active' && !reauth
  const nameMissing = signedIn && needsName(user)
  const phoneMissing = signedIn && (user?.canBook === false || phoneOverride !== null)
  const settled = viewer.state !== 'loading' && viewer.state !== 'suspended'
  const openKey = !settled ? null : !signedIn ? 'signin' : nameMissing ? 'name' : phoneMissing ? 'phone' : 'send'

  // Focus follows the step that opens (never on the first render: a page
  // that just loaded keeps its natural start). Name → phone moves to the
  // phone's own heading, since both sit in step 2.
  const signInHeading = useRef(null)
  const detailsHeading = useRef(null)
  const sendHeading = useRef(null)
  const phoneTitle = useRef(null)
  const lastKey = useRef(null)
  useEffect(() => {
    if (!openKey) return
    const previous = lastKey.current
    lastKey.current = openKey
    if (previous === null || previous === openKey) return
    const target =
      openKey === 'signin' ? signInHeading
        : openKey === 'send' ? sendHeading
          : openKey === 'phone' && previous === 'name' ? phoneTitle
            : detailsHeading
    target.current?.focus()
  }, [openKey])

  const changeHref = `${itemPath(who, id)}${choiceQuery(who, choice)}`

  const onSignOut = () => {
    setPhoneOverride(null)
    setReauth(false)
    setNotice(null)
    void signOut()
  }
  const onSignedIn = () => {
    setReauth(false)
    setNotice(null)
    setGoogleFailed(false)
  }

  let body
  if (!choice.valid) {
    body = (
      <Message text={t.badChoice[who]}>
        <Link className="bk-btn bk-btn-primary" to={changeHref}>{t.change[who]}</Link>
      </Message>
    )
  } else if (item.error || item.data === null) {
    body = (
      <Message text={t.unavailable[who]}>
        <Link className="bk-btn bk-btn-primary" to="/explore">{t.explore}</Link>
      </Message>
    )
  } else if (viewer.state === 'suspended') {
    body = <SuspendedNotice lang={lang} />
  } else {
    const label = accountLabel(user)
    const name = displayName(user)

    const signInSummary = signedIn ? (
      <>
        <span>
          {label ? (
            <>
              {t.signedInAs}{' '}
              <strong>{label.kind === 'name' ? label.text : <bdi dir="ltr">{label.text}</bdi>}</strong>
            </>
          ) : t.signedIn}
        </span>
        <span className="co-sep" aria-hidden="true">·</span>
        <span>
          {t.notYou}{' '}
          <button type="button" className="bk-link" onClick={onSignOut} disabled={signingOut}>{t.signOut}</button>
        </span>
      </>
    ) : null

    const detailsSummary = user ? (
      <>
        {name && <strong>{name}</strong>}
        {name && user.phone && <span className="co-sep" aria-hidden="true">·</span>}
        {user.phone && <bdi dir="ltr">{formatPhone(user.phone)}</bdi>}
        {user.phone && !user.phoneVerified && (
          <>
            <span className="co-tag">{t.notConfirmed}</span>
            {/* An unconfirmed number was typed once and never checked: a
                typo would leave the host unable to call, so it can be fixed. */}
            <button type="button" className="bk-link" aria-label={t.changeNumberLabel} onClick={() => setPhoneOverride('edit')}>
              {t.changeNumber}
            </button>
          </>
        )}
      </>
    ) : null

    const detailsState = !signedIn ? 'todo' : nameMissing || phoneMissing ? 'open' : 'done'
    const sendState = signedIn && !nameMissing && !phoneMissing ? 'open' : 'todo'

    body = (
      <div className="bk-layout co-layout">
        <aside className="co-aside bk-sticky">
          <Summary
            kind={who}
            lang={lang}
            item={item.data}
            choice={choice}
            quote={quote}
            quoteText={quoteText}
            changeHref={changeHref}
          />
        </aside>
        <div className="co-main">
          {viewer.state === 'loading' ? (
            <StepsSkeleton label={t.loading} />
          ) : (
            <div className="co-steps">
              <Step n={1} title={t.stepSignIn} state={signedIn ? 'done' : 'open'} headingRef={signInHeading} summary={signInSummary} lang={lang}>
                {notice?.step === 1 && <p className="bk-alert" role="alert">{notice.text}</p>}
                <SignInPanel
                  returnTo={returnTarget(window.location.origin, location.pathname, location.search)}
                  lang={lang}
                  errorFromReturn={googleFailed}
                  onSignedIn={onSignedIn}
                />
              </Step>

              <Step n={2} title={t.stepDetails} state={detailsState} headingRef={detailsHeading} summary={detailsSummary} lang={lang}>
                {notice?.step === 2 && <p className="bk-alert" role="alert">{notice.text}</p>}
                {nameMissing ? (
                  <NameStep kind={who} lang={lang} />
                ) : (
                  <>
                    {name && (
                      <p className="co-done-line"><CheckIcon /><span>{name}</span></p>
                    )}
                    <PhonePanel
                      key={phoneOverride ?? 'needed'}
                      kind={who}
                      lang={lang}
                      config={viewer.config}
                      titleRef={phoneTitle}
                      initialPhone={phoneOverride === 'edit' ? user?.phone : undefined}
                      onDone={() => {
                        setPhoneOverride(null)
                        setNotice(null)
                      }}
                      onCancel={phoneOverride === 'edit' ? () => setPhoneOverride(null) : undefined}
                    />
                  </>
                )}
              </Step>

              <Step n={3} title={t.stepSend} state={sendState} headingRef={sendHeading} lang={lang}>
                <SendStep
                  kind={who}
                  lang={lang}
                  id={id}
                  choice={choice}
                  user={user}
                  quote={quote}
                  quoteText={quoteText}
                  notes={notes}
                  onNotes={setNotes}
                  changeHref={changeHref}
                  onNeedPhone={(text) => {
                    setNotice({ step: 2, text })
                    setPhoneOverride('required')
                  }}
                  onNeedSignIn={(text) => {
                    setNotice({ step: 1, text })
                    setReauth(true)
                  }}
                />
              </Step>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <PageShell lang={lang} toggleLang={toggleLang} isRtl={isRtl}>
      <div className="co-head">
        <Link className="bk-back" to={changeHref}>
          <BackIcon />
          {t.back[who]}
        </Link>
        <h1 className="bk-h1">{t.title}</h1>
      </div>
      {body}
    </PageShell>
  )
}
