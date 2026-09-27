import { describe, expect, it } from 'vitest'
import { readAuthReturn } from './authReturn'

describe('readAuthReturn', () => {
  it('reads nothing when Google did not send the visitor back with news', () => {
    expect(readAuthReturn('')).toEqual({ kind: null, search: '' })
    expect(readAuthReturn('?next=%2Ftrips')).toEqual({ kind: null, search: '?next=%2Ftrips' })
  })

  it('treats a press of Cancel on Google as nothing to apologise for', () => {
    expect(readAuthReturn('?error=access_denied')).toEqual({ kind: 'cancelled', search: '' })
  })

  it('reports any other failure, and cleans it out of the address', () => {
    expect(readAuthReturn('?checkIn=2026-10-01&error=please_restart_the_process')).toEqual({
      kind: 'failed',
      search: '?checkIn=2026-10-01',
    })
    expect(readAuthReturn('?error=state_mismatch&error_description=x')).toEqual({ kind: 'failed', search: '' })
  })

  it("counts Better Auth's lost-state return as a failure", () => {
    // The callback sends `?state=state_not_found` to the error page (W20).
    expect(readAuthReturn('?state=state_not_found&next=%2Ftrips')).toEqual({
      kind: 'failed',
      search: '?next=%2Ftrips',
    })
  })
})
