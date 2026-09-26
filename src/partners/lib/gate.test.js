import { describe, expect, it } from 'vitest'
import { dashboardPath, partnerRoute, safeNext } from './gate'

const signedIn = (user) => partnerRoute({ isLoading: false, isAuthenticated: true, user })

describe('partnerRoute', () => {
  it('waits while the session or the user row is loading', () => {
    expect(partnerRoute({ isLoading: true, isAuthenticated: false, user: undefined })).toBe('loading')
    expect(partnerRoute({ isLoading: false, isAuthenticated: true, user: undefined })).toBe('loading')
  })

  it('sends a visitor with no session to login', () => {
    expect(partnerRoute({ isLoading: false, isAuthenticated: false, user: undefined })).toBe('login')
    expect(partnerRoute({ isLoading: false, isAuthenticated: false, user: null })).toBe('login')
  })

  it('treats a session without a users row as a new tourist', () => {
    // The auth trigger writes the row just after verify; until then there is nothing to gate on.
    expect(partnerRoute({ isLoading: false, isAuthenticated: true, user: null, accountStatus: { status: 'no_account' } })).toBe('join')
  })

  it('tells a suspended account apart from a new one', () => {
    // getCurrentUser reads a suspended account as null, exactly like a new sign-up.
    const base = { isLoading: false, isAuthenticated: true, user: null }
    expect(partnerRoute({ ...base, accountStatus: { status: 'suspended', reason: 'x' } })).toBe('suspended')
    // Until the status answers, show nothing rather than flash Join.
    expect(partnerRoute({ ...base, accountStatus: undefined })).toBe('loading')
  })

  it('sends a tourist (or no role) to join', () => {
    expect(signedIn({ role: 'tourist' })).toBe('join')
    expect(signedIn({})).toBe('join')
  })

  it.each(['business_owner', 'service_provider'])('%s: no doc, rejected or unapproved -> verify', (role) => {
    expect(signedIn({ role, isApproved: false })).toBe('verify')
    expect(signedIn({ role, isApproved: false, cvFileId: 'f1' })).toBe('verify')
    expect(signedIn({ role, cvFileId: 'f1', accountRejectionReason: 'blurry' })).toBe('verify')
  })

  it('opens the role dashboard once approved', () => {
    expect(signedIn({ role: 'business_owner', isApproved: true, cvFileId: 'f' })).toBe('hotel')
    expect(signedIn({ role: 'service_provider', isApproved: true, cvFileId: 'f' })).toBe('services')
  })

  it('trusts approval even without a doc on file (an admin can approve directly)', () => {
    expect(signedIn({ role: 'business_owner', isApproved: true })).toBe('hotel')
  })

  it('sends an admin to admin', () => {
    expect(signedIn({ role: 'admin' })).toBe('admin')
  })
})

describe('dashboardPath', () => {
  it('maps routes to paths', () => {
    expect(dashboardPath('hotel')).toBe('/partners/hotel')
    expect(dashboardPath('services')).toBe('/partners/services')
    expect(dashboardPath('join')).toBe('/partners/join')
    expect(dashboardPath('verify')).toBe('/partners/verify')
    expect(dashboardPath('login')).toBe('/partners')
    expect(dashboardPath('admin')).toBe('/admin')
  })
})

describe('safeNext', () => {
  it('keeps relative partner paths only', () => {
    expect(safeNext('/partners/hotel')).toBe('/partners/hotel')
    expect(safeNext('//evil.com')).toBeNull()
    expect(safeNext('https://evil.com')).toBeNull()
    expect(safeNext('/\\evil.com')).toBeNull()
    expect(safeNext('/admin')).toBeNull()
    expect(safeNext(null)).toBeNull()
  })
})
