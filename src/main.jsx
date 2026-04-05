import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConvexReactClient } from 'convex/react'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { authClient } from './lib/auth-client'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

// Lazy-load all route components
const App = lazy(() => import('./App.jsx'))
const MapPage = lazy(() => import('./MapPage.jsx').catch(() => {
  // Retry once on chunk load failure (common with slow connections)
  return new Promise(resolve => setTimeout(resolve, 1500)).then(() => import('./MapPage.jsx'))
}))
const AdminPage = lazy(() => import('./AdminPage.jsx'))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage.jsx'))
const SignInPage = lazy(() => import('./pages/SignInPage.jsx'))
const SignUpPage = lazy(() => import('./pages/SignUpPage.jsx'))
const BusinessDashboard = lazy(() => import('./pages/DoctorDashboard.jsx'))
const TouristDashboard = lazy(() => import('./pages/PatientDashboard.jsx'))
const ListingsPage = lazy(() => import('./pages/ListingsPage.jsx'))
const ServicesPage = lazy(() => import('./pages/ServicesPage.jsx'))

// Convex client — needs VITE_CONVEX_URL to be set
const convexUrl = import.meta.env.VITE_CONVEX_URL
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null

// Simple page loader (not lazy-loaded)
function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'system-ui' }}>
      <div style={{
        width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#0D7A5F',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// Redirect from / based on onboarding status
function RootRedirect() {
  const done = localStorage.getItem('hasio_onboarding_done')
  return done ? <Navigate to="/home" replace /> : <Navigate to="/welcome" replace />
}

// All routes under Better-Auth provider (including admin)
function MainRoutes() {
  if (!convex) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="*" element={<App />} />
        </Routes>
      </Suspense>
    )
  }
  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/welcome" element={<OnboardingPage />} />
          <Route path="/home" element={<App />} />
          <Route path="/explore" element={<MapPage />} />
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/sign-up" element={<SignUpPage />} />
          <Route path="/dashboard" element={<TouristDashboard />} />
          <Route path="/business" element={<BusinessDashboard />} />
          <Route path="/listings" element={<ListingsPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </ConvexBetterAuthProvider>
  )
}

function NoBackend() {
  return (
    <div style={{ padding: '3rem', textAlign: 'center', fontFamily: 'system-ui' }}>
      <h1 style={{ color: '#0D7A5F' }}>Hasio — هاسيو</h1>
      <p style={{ marginTop: '1rem', color: '#6b7280' }}>
        Run <code style={{ background: '#f3f4f6', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>npx convex dev</code> to connect to a Convex backend.
      </p>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <MainRoutes />
    </BrowserRouter>
  </StrictMode>,
)
