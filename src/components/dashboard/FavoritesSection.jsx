import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { motion, AnimatePresence } from 'framer-motion'
import SaveToTripModal from '../trips/SaveToTripModal'

const translations = {
  ar: {
    title: 'المفضلة',
    noFavorites: 'لا توجد أماكن مفضلة',
    noFavoritesDesc: 'أضف أماكن إلى المفضلة من صفحة الاستكشاف',
    explore: 'استكشف السعودية',
    remove: 'إزالة',
    hotel: 'فندق',
    restaurant: 'مطعم',
    attraction: 'معلم سياحي',
    event: 'فعالية',
    tour: 'جولة',
    saveToTrip: 'أضف لرحلة',
  },
  en: {
    title: 'Favorites',
    noFavorites: 'No favorite places yet',
    noFavoritesDesc: 'Add places to favorites from the explore page',
    explore: 'Explore Saudi Arabia',
    remove: 'Remove',
    hotel: 'Hotel',
    restaurant: 'Restaurant',
    attraction: 'Attraction',
    event: 'Event',
    tour: 'Tour',
    saveToTrip: 'Add to Trip',
  }
}

export default function FavoritesSection({ lang = 'ar', user }) {
  const t = translations[lang] || translations.ar
  const isRTL = lang === 'ar'
  const [saveToTripId, setSaveToTripId] = useState(null)
  const [saveToTripName, setSaveToTripName] = useState('')

  const favorites = useQuery(api.users.queries.getFavorites, {})
  const toggleFavorite = useMutation(api.users.mutations.toggleFavorite)

  const handleRemove = async (listingId) => {
    try {
      await toggleFavorite({ listingId })
    } catch (err) {
      console.error('Remove favorite error:', err)
    }
  }

  const typeLabel = (type) => t[type] || type

  if (favorites === undefined) {
    return <div style={{ textAlign: 'center', color: '#9ca3af', padding: '3rem' }}>
      {isRTL ? 'جاري التحميل...' : 'Loading...'}
    </div>
  }

  return (
    <div>
      <h2 className="dashboard-section-title">{t.title}</h2>

      {favorites.length === 0 ? (
        <div className="empty-state">
          <HeartEmptyIcon />
          <h3>{t.noFavorites}</h3>
          <p>{t.noFavoritesDesc}</p>
          <a href="/explore" className="btn-primary" style={{ textDecoration: 'none' }}>
            {t.explore}
          </a>
        </div>
      ) : (
        <AnimatePresence>
          {favorites.map(listing => (
            <motion.div
              key={listing._id}
              className="dash-card"
              layout
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="apt-card">
                <div className="apt-info">
                  <h3>{isRTL ? listing.name_ar : listing.name_en}</h3>
                  <p>
                    {typeLabel(listing.type)}
                    {' · '}
                    {isRTL ? listing.category_ar : listing.category}
                    {listing.city && ` · ${listing.city}`}
                  </p>
                  {listing.rating && (
                    <p style={{ fontSize: '0.8125rem', color: '#f59e0b' }}>
                      {'★'.repeat(Math.round(listing.rating))} {listing.rating.toFixed(1)}
                    </p>
                  )}
                  {listing.priceRange && (
                    <p style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                      {listing.priceRange}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                  <button
                    className="apt-action-btn"
                    onClick={() => { setSaveToTripId(listing._id); setSaveToTripName(isRTL ? listing.name_ar : listing.name_en) }}
                    style={{ fontSize: '0.75rem' }}
                  >
                    {t.saveToTrip}
                  </button>
                  <button
                    className="apt-action-btn danger"
                    onClick={() => handleRemove(listing._id)}
                    style={{ fontSize: '0.75rem' }}
                  >
                    {t.remove}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      {saveToTripId && (
        <SaveToTripModal
          listingId={saveToTripId}
          listingName={saveToTripName}
          lang={lang}
          isOpen={!!saveToTripId}
          onClose={() => setSaveToTripId(null)}
        />
      )}
    </div>
  )
}

function HeartEmptyIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}
