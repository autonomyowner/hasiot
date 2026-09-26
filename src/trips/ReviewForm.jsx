import { useEffect, useId, useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { bookingErrorText } from '../booking/errors'
import { starsText } from './tripDisplay'
import './trips.css'

// The server's limit (MAX_REVIEW_TEXT in convex/reviews/logic.ts) and the
// app's: a longer text would only be refused after the traveller wrote it.
const MAX_TEXT = 500

const translations = {
  en: {
    rating: 'Your rating',
    needsStars: 'Choose a star rating first',
    content: 'Tell others about it (optional)',
    anonymous: 'Post without my name',
    post: 'Post review',
  },
  ar: {
    rating: 'تقييمك',
    needsStars: 'اختر عدد النجوم أولاً',
    content: 'أخبر الآخرين عن تجربتك (اختياري)',
    anonymous: 'النشر دون اسمي',
    post: 'نشر التقييم',
  },
}

const Star = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
    <path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z" />
  </svg>
)

/**
 * Rating a completed stay or service, sent with its booking id so the server
 * can mark the review verified (design W10) — nothing here claims it.
 *
 * The stars are a native radio group: arrow keys move between them and choose,
 * the chosen star is the checked one, and each is named "1 star" … "5 stars".
 * The button is never faded while no star is chosen; pressed early, it says so
 * and puts focus on the stars.
 */
export default function ReviewForm({ target, bookingId, lang, autoFocus = false, onDone }) {
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const addReview = useMutation(api.reviews.mutations.addReview)
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [content, setContent] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [needsStars, setNeedsStars] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const busyRef = useRef(false)
  const firstStar = useRef(null)
  const id = useId()

  useEffect(() => {
    if (autoFocus) firstStar.current?.focus()
  }, [autoFocus])

  const submit = async (event) => {
    event.preventDefault()
    if (busyRef.current) return
    if (rating < 1) {
      setNeedsStars(true)
      firstStar.current?.focus()
      return
    }
    busyRef.current = true
    setBusy(true)
    setError(null)
    let posted = false
    try {
      await addReview({
        ...target,
        rating,
        content: content.trim() || undefined,
        bookingId,
        isAnonymous: anonymous,
      })
      posted = true
    } catch (err) {
      // Every refusal here is the server's bilingual text; its half in the
      // page's language reads correctly, and anything internal reads generic.
      setError(bookingErrorText(err, lang))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
    if (posted) onDone?.(rating)
  }

  const shown = hover || rating

  return (
    <form className="tr-review" onSubmit={submit} noValidate>
      <fieldset className="tr-stars" aria-describedby={needsStars ? `${id}-stars-error` : undefined}>
        <legend className="bk-label">{t.rating}</legend>
        <div className="tr-stars-row" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={`tr-star${n <= shown ? ' is-on' : ''}`} onMouseEnter={() => setHover(n)}>
              <input
                ref={n === 1 ? firstStar : undefined}
                type="radio"
                name={`${id}-rating`}
                value={n}
                checked={rating === n}
                onChange={() => {
                  setRating(n)
                  setNeedsStars(false)
                }}
              />
              <Star />
              <span className="bk-sr">{starsText(n, lang)}</span>
            </label>
          ))}
        </div>
        {needsStars ? (
          <p className="bk-error" id={`${id}-stars-error`} role="alert">
            {t.needsStars}
          </p>
        ) : null}
      </fieldset>

      <div className="bk-field">
        <label className="bk-label" htmlFor={`${id}-text`}>
          {t.content}
        </label>
        <textarea
          id={`${id}-text`}
          className="bk-textarea"
          value={content}
          // The field stops at the limit itself, so the counter never reads
          // past it and nothing typed is cut off on the server.
          maxLength={MAX_TEXT}
          onChange={(e) => setContent(e.target.value)}
          aria-describedby={`${id}-count`}
        />
        <span className="bk-counter" id={`${id}-count`}>
          {content.length}/{MAX_TEXT}
        </span>
      </div>

      <label className="tr-check">
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
        <span>{t.anonymous}</span>
      </label>

      {error ? (
        <p className="bk-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="bk-btn bk-btn-primary" disabled={busy} aria-busy={busy || undefined}>
        {busy ? <span className="bk-spinner" aria-hidden="true" /> : null}
        {t.post}
      </button>
    </form>
  )
}
