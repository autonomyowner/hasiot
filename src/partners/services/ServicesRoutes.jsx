import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

// Each page is its own chunk; PartnersLayout's Suspense keeps the shell up.
const Overview = lazy(() => import('./Overview.jsx'))
const MyServices = lazy(() => import('./MyServices.jsx'))
const ServiceForm = lazy(() => import('./ServiceForm.jsx'))
const Bookings = lazy(() => import('./Bookings.jsx'))
const AnalyticsPage = lazy(() => import('../insights/AnalyticsPage.jsx'))
const GuestsPage = lazy(() => import('../insights/GuestsPage.jsx'))

/** The provider dashboard, under /partners/services/*. Every page guards itself. */
export default function ServicesRoutes() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="mine" element={<MyServices />} />
      <Route path="mine/new" element={<ServiceForm />} />
      <Route path="mine/:id" element={<ServiceForm />} />
      <Route path="bookings" element={<Bookings />} />
      <Route path="analytics" element={<AnalyticsPage role="services" />} />
      <Route path="guests" element={<GuestsPage role="services" />} />
      <Route path="*" element={<Navigate to="/partners/services" replace />} />
    </Routes>
  )
}
