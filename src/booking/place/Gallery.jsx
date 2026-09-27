import { useState } from 'react'

const translations = {
  en: { prev: 'Previous photo', next: 'Next photo', photo: (i, n) => `Photo ${i} of ${n}`, none: 'No photos yet' },
  ar: { prev: 'الصورة السابقة', next: 'الصورة التالية', photo: (i, n) => `الصورة ${i} من ${n}`, none: 'لا توجد صور بعد' },
}

// Drawn for left-to-right; booking.css mirrors them in RTL.
const Prev = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
)
const Next = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
)
const Picture = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 8" />
  </svg>
)

/**
 * A place's or a service's photos: one large, thumbnails under it, and
 * previous/next. The first photo loads eagerly (it is the page's largest
 * image); the rest wait until they are asked for. With no photos, a sand
 * panel stands in rather than a broken image.
 */
export default function Gallery({ images, name, lang }) {
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const photos = (images ?? []).filter((src) => typeof src === 'string' && src)
  const [index, setIndex] = useState(0)
  const count = photos.length
  const current = Math.min(index, Math.max(0, count - 1))

  if (count === 0) {
    return (
      <div className="bk-gallery">
        <div className="bk-gallery-main bk-gallery-empty" role="img" aria-label={t.none}>
          <Picture />
        </div>
      </div>
    )
  }

  const go = (step) => setIndex((current + step + count) % count)

  return (
    <div className="bk-gallery">
      <div className="bk-gallery-main">
        <img
          src={photos[current]}
          alt={count > 1 ? `${name} — ${t.photo(current + 1, count)}` : name}
          loading={current === 0 ? 'eager' : 'lazy'}
          fetchPriority={current === 0 ? 'high' : undefined}
          decoding="async"
        />
        {count > 1 && (
          <>
            <button type="button" className="bk-gallery-arrow is-prev" onClick={() => go(-1)} aria-label={t.prev}>
              <Prev />
            </button>
            <button type="button" className="bk-gallery-arrow is-next" onClick={() => go(1)} aria-label={t.next}>
              <Next />
            </button>
            <span className="bk-gallery-count" aria-hidden="true">{current + 1} / {count}</span>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="bk-thumbs">
          {photos.map((src, i) => (
            <button
              type="button"
              key={`${i}-${src}`}
              className="bk-thumb"
              onClick={() => setIndex(i)}
              aria-current={i === current ? 'true' : undefined}
              aria-label={t.photo(i + 1, count)}
            >
              <img src={src} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
