import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { ClerkProvider, useAuth } from '@clerk/clerk-react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { ConvexReactClient, ConvexProvider } from 'convex/react'
import './index.css'
import App from './App.jsx'
import MapPage from './MapPage.jsx'
import AdminPage from './AdminPage.jsx'

// Convex client
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)

// Clerk publishable key
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!clerkPubKey) {
  console.warn('Missing VITE_CLERK_PUBLISHABLE_KEY - auth features will be disabled')
}

// Admin routes use ConvexProvider without Clerk (has its own auth)
function AdminRoutes() {
  return (
    <ConvexProvider client={convex}>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </ConvexProvider>
  )
}

// Main app routes with Clerk auth
function MainRoutes() {
  if (!clerkPubKey) {
    return (
      <ConvexProvider client={convex}>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/map" element={<MapPage />} />
        </Routes>
      </ConvexProvider>
    )
  }

  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/map" element={<MapPage />} />
        </Routes>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}

// Router component that decides which provider to use
function AppRouter() {
  const location = useLocation()

  // Admin routes bypass Clerk entirely
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
