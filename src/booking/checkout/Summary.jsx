import { Link } from 'react-router-dom'
import { daysBetween, formatDayLong, formatRange } from '../dates'
import { formatSAR } from '../money'
import { guestsText, nightsText, peopleText, quantityText } from '../text'
import { cityName, serviceTitle, serviceTypeLabel } from '../../partners/services/labels'
import { breakdownLine } from './choice'
import { PictureIcon } from './icons'

const translations = {
  en: {
    label: 'Your request',
    dates: 'Dates',
    day: 'Day',
    start: 'Start',
    saudiTime: 'Saudi time',
    duration: 'Duration',
    people: 'People',
    checkIn: (time) => `Check-in from ${time}`,
    checkOut: (time) => `Check-out by ${time}`,
    change: 'Change',
    changeLabel: { stay: 'Change the dates or guests', service: 'Change the day, time or people' },
    calculating: 'Calculating total…',
    price: 'Price',
    total: 'Total',
    note: {
      stay: 'The host confirms within 48 hours. No payment is taken online — you pay at the property.',
      service: "The provider confirms within 48 hours, or before the start time if that's sooner. You pay the provider directly.",
    },
  },
  ar: {
    label: 'طلبك',
    dates: 'التواريخ',
    day: 'اليوم',
    start: 'البدء',
    saudiTime: 'بتوقيت السعودية',
    duration: 'المدة',
    people: 'الأشخاص',
    checkIn: (time) => `الوصول من ${time}`,
    checkOut: (time) => `المغادرة حتى ${time}`,
    change: 'تغيير',
    changeLabel: { stay: 'تغيير التواريخ أو عدد الضيوف', service: 'تغيير اليوم أو الوقت أو عدد الأشخاص' },
    calculating: 'جارٍ حساب الإجمالي…',
    price: 'السعر',
    total: 'الإجمالي',
    note: {
      stay: 'يؤكد المضيف خلال 48 ساعة. لا يُدفع شيء عبر الإنترنت — الدفع في مكان الإقامة.',
      service: 'يؤكد مقدم الخدمة خلال 48 ساعة، أو قبل وقت البدء إن كان أقرب. تدفع لمقدم الخدمة مباشرة.',
    },
  },
}

const placeName = (listing, lang) =>
  (lang === 'ar' ? listing?.name_ar || listing?.name_en : listing?.name_en || listing?.name_ar) || ''

/**
 * What is being asked for, beside the steps (first on a phone): the place or
 * service, the dates or the day and time, who is coming, the live price and
 * how payment works. "Change" goes back to the page it came from with the
 * choice kept. The figures are the server's quote, never computed here.
 */
export default function Summary({ kind, lang, item, choice, quote, quoteText, changeHref }) {
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const who = kind === 'service' ? 'service' : 'stay'

  if (!item) {
    return (
      <section className="bk-card bk-summary co-summary" aria-busy="true" aria-label={t.label}>
        <div className="co-sum-item">
          <div className="co-sum-photo bk-skel" />
          <div className="co-skel">
            <div className="bk-skel co-skel-line" />
            <div className="bk-skel co-skel-line is-short" />
          </div>
        </div>
        <div className="bk-skel co-skel-block" />
      </section>
    )
  }

  const name = who === 'service' ? serviceTitle(item, lang) : placeName(item, lang)
  const city = cityName(item.city, lang)
  const kicker = who === 'service' ? [serviceTypeLabel(item.serviceType, lang), city].filter(Boolean).join(' · ') : city
  const photo = (item.images ?? []).find((src) => typeof src === 'string' && src)
  const ok = quote.status === 'ok' ? quote : null

  let facts
  if (who === 'service') {
    const unit = ok?.quote.priceUnit ?? item.priceUnit
    const duration = quantityText(unit, ok?.quote.quantity ?? choice.quantity ?? 1, lang)
    facts = (
      <>
        <div className="co-fact"><dt>{t.day}</dt><dd>{formatDayLong(choice.date, lang)}</dd></div>
        <div className="co-fact">
          <dt>{t.start}</dt>
          <dd><span><span dir="ltr">{choice.time}</span> · {t.saudiTime}</span></dd>
        </div>
        {duration && <div className="co-fact"><dt>{t.duration}</dt><dd>{duration}</dd></div>}
        <div className="co-fact"><dt>{t.people}</dt><dd>{peopleText(choice.people, lang)}</dd></div>
      </>
    )
  } else {
    const nights = daysBetween(choice.checkIn, choice.checkOut)
    facts = (
      <div className="co-fact">
        <dt>{t.dates}</dt>
        <dd>
          <span>{formatRange(choice.checkIn, choice.checkOut, lang)}</span>
          <span className="co-fact-sub">{nightsText(nights, lang)} · {guestsText(choice.guests, lang)}</span>
        </dd>
      </div>
    )
  }

  const times = ok && who === 'stay'
    ? [ok.checkInTime && t.checkIn(ok.checkInTime), ok.checkOutTime && t.checkOut(ok.checkOutTime)].filter(Boolean).join(' · ')
    : ''
  const line = ok ? breakdownLine(who, ok.quote, lang) : null

  return (
    <section className="bk-card bk-summary co-summary" aria-label={t.label}>
      <div className="co-sum-item">
        <div className="co-sum-photo">
          {photo ? <img src={photo} alt={name} loading="lazy" decoding="async" /> : <PictureIcon />}
        </div>
        <div className="co-sum-text">
          {kicker && <p className="co-sum-kicker">{kicker}</p>}
          <h2 className="co-sum-name">{name}</h2>
        </div>
      </div>

      <dl className="co-facts">{facts}</dl>
      {times && <p className="co-times">{times}</p>}
      <Link className="bk-link co-change" to={changeHref} aria-label={t.changeLabel[who]}>{t.change}</Link>

      <hr className="bk-divider" />

      <div className="co-price" aria-live="polite">
        {quote.status === 'loading' && <p className="bk-note">{t.calculating}</p>}
        {line && (
          <>
            <div className="bk-price-row"><span>{line.label ?? t.price}</span><span>{line.amount}</span></div>
            <div className="bk-total"><span>{t.total}</span><span>{formatSAR(ok.quote.totalAmount, lang)}</span></div>
          </>
        )}
        {quote.status === 'refused' && <p className="bk-note">{quoteText}</p>}
      </div>
      <p className="bk-note">{t.note[who]}</p>
    </section>
  )
}
