import { describe, expect, it } from 'vitest'
import { shouldRemember, steadyOf } from './steady'

const config = { googleAuth: true }
const loading = { state: 'loading', user: null, config }
const signedOut = { state: 'signed_out', user: null, config }
const user = { _id: 'U1', firstName: 'Sara' }
const active = { state: 'active', user, config }

describe('steadyOf', () => {
  it('shows loading until the viewer has settled once', () => {
    expect(steadyOf(loading, loading)).toBe(loading)
  })

  it('keeps the last settled answer through a later loading blip', () => {
    // A signed-out visitor's session is refetched on every return to the tab,
    // and reads as pending meanwhile: the sign-in form must not unmount.
    expect(steadyOf(loading, signedOut)).toBe(signedOut)
    expect(steadyOf(loading, active)).toBe(active)
  })

  it('shows any settled answer as it is', () => {
    expect(steadyOf(active, signedOut)).toBe(active)
    expect(steadyOf(signedOut, active)).toBe(signedOut)
  })
})

describe('shouldRemember', () => {
  it('remembers a new settled answer', () => {
    expect(shouldRemember(signedOut, loading)).toBe(true)
    expect(shouldRemember(active, signedOut)).toBe(true)
    expect(shouldRemember({ ...active, user: { ...user, canBook: true } }, active)).toBe(true)
    expect(shouldRemember({ ...active, config: { googleAuth: false } }, active)).toBe(true)
  })

  it('never remembers loading', () => {
    expect(shouldRemember(loading, signedOut)).toBe(false)
  })

  it('does nothing when the answer is the same', () => {
    expect(shouldRemember({ ...active }, active)).toBe(false)
  })

  it('compares by content, so a fresh copy of the same user cannot loop', () => {
    expect(shouldRemember({ state: 'active', user: { ...user }, config: { ...config } }, active)).toBe(false)
  })
})
