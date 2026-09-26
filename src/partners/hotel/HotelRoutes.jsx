import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

const Overview = lazy(() => import('./Overview.jsx'))
const MyPlaces = lazy(() => import('./MyPlaces.jsx'))
const PlaceForm = lazy(() => import('./PlaceForm.jsx'))
const Bookings = lazy(() => import('./Bookings.jsx'))
const AnalyticsPage = lazy(() => import('../insights/AnalyticsPage.jsx'))
const GuestsPage = lazy(() => import('../insights/GuestsPage.jsx'))

/**
 * The hotel dashboard, under /partners/hotel/*. Every page carries its own
 * usePartnerGate('hotel'), so a provider or a pending account that opens one
 * of these URLs is sent where it belongs.
 */
export default function HotelRoutes() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="places" element={<MyPlaces />} />
      <Route path="places/new" element={<PlaceForm />} />
      <Route path="places/:id" element={<PlaceForm />} />
      <Route path="bookings" element={<Bookings />} />
      <Route path="analytics" element={<AnalyticsPage role="hotel" />} />
      <Route path="guests" element={<GuestsPage role="hotel" />} />
      <Route path="*" element={<Navigate to="/partners/hotel" replace />} />
    </Routes>
  )
}
