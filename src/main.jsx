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
import DoctorDashboard from './pages/DoctorDashboard.jsx'
import PatientDashboard from './pages/PatientDashboard.jsx'
import PublicHealthCard from './pages/PublicHealthCard.jsx'

// Convex client
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)

// Admin routes use ConvexProvider without auth (has its own session auth)
function AdminRoutes() {
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
  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />
        <Route path="/dashboard" element={<PatientDashboard />} />
        <Route path="/doctor-dashboard" element={<DoctorDashboard />} />
        <Route path="/card/:cardNumber" element={<PublicHealthCard />} />
      </Routes>
    </ConvexBetterAuthProvider>
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
