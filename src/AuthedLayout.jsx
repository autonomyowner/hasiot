import { Outlet } from 'react-router-dom'
import { ConvexReactClient } from 'convex/react'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { authClient } from './lib/auth-client'

// Everything Convex/Better-Auth lives in this module so it can be lazy-loaded.
// The public landing page never imports it, which keeps the convex and
// better-auth chunks off the critical path for anonymous visitors.
const convexUrl = import.meta.env.VITE_CONVEX_URL
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null

function NoBackend() {
  return (
    <div style={{ padding: '3rem', textAlign: 'center', fontFamily: 'system-ui' }}>
      <h1 style={{ color: '#0D7A5F' }}>Hasio</h1>
      <p style={{ marginTop: '1rem', color: '#6b7280' }}>
        Set <code style={{ background: '#f3f4f6', padding: '0.25rem 0.5rem', borderRadius: 4 }}>VITE_CONVEX_URL</code> to connect to a Convex backend.
      </p>
    </div>
  )
}

// Layout route — mounts once and stays mounted across /sign-in, /delete-account
// and /admin, so the session isn't refetched when moving between them.
export default function AuthedLayout() {
  if (!convex) return <NoBackend />
  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <Outlet />
    </ConvexBetterAuthProvider>
  )
}
