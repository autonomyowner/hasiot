import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { ConvexReactClient, ConvexProvider } from 'convex/react'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { authClient } from './lib/auth-client'
import './index.css'
import App from './App.jsx'
import MapPage from './MapPage.jsx'
import AdminPage from './AdminPage.jsx'
import SignInPage from './pages/SignInPage.jsx'
import SignUpPage from './pages/SignUpPage.jsx'
import BusinessDashboard from './pages/DoctorDashboard.jsx'
import TouristDashboard from './pages/PatientDashboard.jsx'

// Convex client — needs VITE_CONVEX_URL to be set
const convexUrl = import.meta.env.VITE_CONVEX_URL
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null

// Admin routes use ConvexProvider without auth (has its own session auth)
function AdminRoutes() {
  if (!convex) return <NoBackend />
  return (
    <ConvexProvider client={convex}>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </ConvexProvider>
  )
}

// Main app routes with Better-Auth
function MainRoutes() {
  if (!convex) {
    return (
      <Routes>
        <Route path="*" element={<App />} />
      </Routes>
    )
  }
  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/explore" element={<MapPage />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />
        <Route path="/dashboard" element={<TouristDashboard />} />
        <Route path="/business" element={<BusinessDashboard />} />
      </Routes>
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

// Router component that decides which provider to use
function AppRouter() {
  const location = useLocation()

  // Admin routes bypass auth provider entirely
  if (location.pathname.startsWith('/admin')) {
    return <AdminRoutes />
  }

  return <MainRoutes />
}

function AppWithProviders() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppWithProviders />
  </StrictMode>,
)
