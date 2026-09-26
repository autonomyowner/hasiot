import { useId } from 'react'
import { Link } from 'react-router-dom'
import StatusChip from '../booking/StatusChip'
import { tripImage, tripName, tripTotal, tripWhat, tripWhen } from './tripDisplay'
import './trips.css'

const translations = {
  en: { gone: 'No longer on Hasio' },
  ar: { gone: 'لم يعد على Hasio' },
}

/**
 * One booking in My trips: photo, name, when, what, status and total.
 *
 * The whole card opens the booking, but only the name is the link (its
 * ::after covers the card): a card-sized link would be read aloud as one long
 * name. The lines under it are attached as its description instead, so two
 * stays at the same hotel still sound different. The photo sits beside the
 * name it would repeat, so it is decorative (empty alt).
 */
export default function TripCard({ booking, lang, now }) {
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const id = useId()
  const name = tripName(booking, lang)
  const image = tripImage(booking)
  const when = tripWhen(booking, lang)
  const what = tripWhat(booking, lang)
  const total = tripTotal(booking, lang)
  const described = [`${id}-when`, what && `${id}-what`, `${id}-status`, total && `${id}-total`].filter(Boolean).join(' ')

  return (
    <article className="tr-card">
      <div className="tr-card-media">
        {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : null}
      </div>
      <div className="tr-card-body">
        <h2 className="tr-card-name">
          <Link className="tr-card-link" to={`/trips/${booking._id}`} aria-describedby={described}>
            {name ?? <span className="tr-gone">{t.gone}</span>}
          </Link>
        </h2>
        <p className="tr-card-line" id={`${id}-when`}>{when}</p>
        {what ? <p className="tr-card-line" id={`${id}-what`}>{what}</p> : null}
        <div className="tr-card-foot">
          <span id={`${id}-status`}>
            <StatusChip booking={booking} lang={lang} now={now} />
          </span>
          {total ? <span className="tr-card-total" id={`${id}-total`}>{total}</span> : null}
        </div>
      </div>
    </article>
  )
}
