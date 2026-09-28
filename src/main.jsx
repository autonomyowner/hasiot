import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import PageLoader from './components/PageLoader'
import ScrollToTop from './components/ScrollToTop'
import './index.css'

// The public landing page. Loaded eagerly-ish as the only route most visitors
// ever hit; everything else is behind the authed layout.
const App = lazy(() => import('./App.jsx'))
// Every live hotel and place with search. Public and anonymous like /, so it
// sits outside AuthedLayout and reads the backend with a plain fetch.
const ExplorePage = lazy(() => import('./pages/ExplorePage.jsx'))
const FilmPage = lazy(() => import('./pages/film/FilmPage.jsx'))
// One place or one service, with its booking section. Public like /explore:
// plain fetch, no Convex client, no Better Auth (src/lib/convexHttp.js).
const PlacePage = lazy(() => import('./pages/PlacePage.jsx'))
const ServicePage = lazy(() => import('./pages/ServicePage.jsx'))

// Convex + Better-Auth are confined to this layout chunk so they never load for
// anonymous visitors on /.
const AuthedLayout = lazy(() => import('./AuthedLayout.jsx'))
const AdminPage = lazy(() => import('./admin/AdminPage.jsx'))
const SignInPage = lazy(() => import('./pages/SignInPage.jsx'))
const DeleteAccountPage = lazy(() => import('./pages/DeleteAccountPage.jsx'))

// Partner portal (hotels and service providers). Unlinked until SMS sign-in is
// real in production; every screen is its own lazy chunk inside AuthedLayout.
const PartnersLayout = lazy(() => import('./partners/PartnersLayout.jsx'))
const PartnerLogin = lazy(() => import('./partners/pages/LoginPage.jsx'))
const PartnerJoin = lazy(() => import('./partners/pages/JoinPage.jsx'))
const PartnerVerify = lazy(() => import('./partners/pages/VerifyPage.jsx'))
const PartnerSuspended = lazy(() => import('./partners/pages/SuspendedPage.jsx'))
const PartnerHotel = lazy(() => import('./partners/hotel/HotelRoutes.jsx'))
const PartnerServices = lazy(() => import('./partners/services/ServicesRoutes.jsx'))

// The traveller's signed-in pages: sign-in, the checkout, and My trips
// (design docs/superpowers/specs/2026-09-26-web-booking-design.md).
const TravellerLogin = lazy(() => import('./booking/LoginPage.jsx'))
const CheckoutPage = lazy(() => import('./booking/CheckoutPage.jsx'))
const TripsPage = lazy(() => import('./trips/TripsPage.jsx'))
const TripPage = lazy(() => import('./trips/TripPage.jsx'))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/hasiofilm" element={<FilmPage />} />
            <Route path="/places/:id" element={<PlacePage />} />
            <Route path="/services/:id" element={<ServicePage />} />

            {/* /sign-in is the admin portal's email login (unlinked);
                /delete-account is required by the App Store and is linked from
                public/support.html. /login is the traveller's sign-in. */}
            <Route element={<AuthedLayout />}>
              <Route path="/sign-in" element={<SignInPage />} />
              <Route path="/delete-account" element={<DeleteAccountPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/login" element={<TravellerLogin />} />
              <Route path="/book/stay/:listingId" element={<CheckoutPage kind="stay" />} />
              <Route path="/book/service/:serviceId" element={<CheckoutPage kind="service" />} />
              <Route path="/trips" element={<TripsPage />} />
              <Route path="/trips/:bookingId" element={<TripPage />} />
              <Route path="/partners" element={<PartnersLayout />}>
                <Route index element={<PartnerLogin />} />
                <Route path="join" element={<PartnerJoin />} />
                <Route path="verify" element={<PartnerVerify />} />
                <Route path="suspended" element={<PartnerSuspended />} />
                <Route path="hotel/*" element={<PartnerHotel />} />
                <Route path="services/*" element={<PartnerServices />} />
                <Route path="*" element={<Navigate to="/partners" replace />} />
              </Route>
            </Route>

            {/* Old routes and bookmarks land on the new single page rather than
                rendering blank. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
