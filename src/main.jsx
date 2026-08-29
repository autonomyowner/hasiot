import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import PageLoader from './components/PageLoader'
import './index.css'

// The public landing page. Loaded eagerly-ish as the only route most visitors
// ever hit; everything else is behind the authed layout.
const App = lazy(() => import('./App.jsx'))

// Convex + Better-Auth are confined to this layout chunk so they never load for
// anonymous visitors on /.
const AuthedLayout = lazy(() => import('./AuthedLayout.jsx'))
const AdminPage = lazy(() => import('./AdminPage.jsx'))
const SignInPage = lazy(() => import('./pages/SignInPage.jsx'))
const DeleteAccountPage = lazy(() => import('./pages/DeleteAccountPage.jsx'))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<App />} />

            {/* Not linked from anywhere. /sign-in exists so the admin portal has
                a login; /delete-account is required by the App Store and is
                linked from public/support.html. */}
            <Route element={<AuthedLayout />}>
              <Route path="/sign-in" element={<SignInPage />} />
              <Route path="/delete-account" element={<DeleteAccountPage />} />
              <Route path="/admin" element={<AdminPage />} />
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
