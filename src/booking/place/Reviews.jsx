import { monthLabel, monthOf, riyadhToday } from '../dates'
import { reviewsText } from '../text'

const translations = {
  en: {
    heading: 'Reviews',
    none: 'No reviews yet.',
    anonymous: 'A traveller',
    verified: { stay: 'Verified stay', service: 'Verified booking' },
    stars: (n) => `${n} out of 5`,
  },
  ar: {
    heading: 'التقييمات',
    none: 'لا توجد تقييمات بعد.',
    anonymous: 'مسافر',
    verified: { stay: 'إقامة موثّقة', service: 'حجز موثّق' },
    stars: (n) => `${n} من 5`,
  },
}

const Star = ({ off }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={off ? 'is-off' : undefined}>
    <path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" />
  </svg>
)
const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
)

/** "★ 4.6 · 12 reviews", for the top of a page. Nothing while there are none. */
export function RatingLine({ summary, lang }) {
  if (!summary || !summary.count || summary.average == null) return null
  return (
    <span className="bk-rating">
      <Star />
      <span>{summary.average.toFixed(1)}</span>
      <span className="bk-muted">· {reviewsText(summary.count, lang)}</span>
    </span>
  )
}

function Stars({ rating, lang }) {
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  return (
    <span className="bk-stars" role="img" aria-label={t.stars(rating)}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} off={n > rating} />)}
    </span>
  )
}

/**
 * The reviews section of a place or service page: the average and the count,
 * then the newest reviews. An anonymous review has no author on the wire at
 * all (convex/reviews/queries.ts presentReviews), so it reads "A traveller".
 */
export default function Reviews({ summary, reviews, lang, kind = 'stay', headingLevel = 2 }) {
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const Heading = `h${headingLevel}`
  const list = reviews ?? []
  return (
    <section className="bk-reviews" aria-labelledby="bk-reviews-title">
      <div className="bk-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <Heading id="bk-reviews-title" className="bk-h2">{t.heading}</Heading>
        <RatingLine summary={summary} lang={lang} />
      </div>
      {list.length === 0 ? (
        <p className="bk-muted">{t.none}</p>
      ) : (
        <ul className="bk-reviews-list">
          {list.map((review) => {
            const who = review.user
              ? [review.user.firstName, review.user.lastName].filter(Boolean).join(' ').trim() || t.anonymous
              : t.anonymous
            return (
              <li key={review._id} className="bk-review">
                <div className="bk-review-head">
                  <span className="bk-review-who" dir="auto">{who}</span>
                  <Stars rating={review.rating} lang={lang} />
                </div>
                <div className="bk-review-meta">
                  <span>{monthLabel(monthOf(riyadhToday(review.createdAt)), lang)}</span>
                  {review.isVerified && (
                    <span className="bk-verified"><Check />{t.verified[kind === 'service' ? 'service' : 'stay']}</span>
                  )}
                </div>
                {review.content && <p dir="auto">{review.content}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
