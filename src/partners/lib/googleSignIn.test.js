import { describe, expect, it } from 'vitest'
import { googleReturnURL, oauthStartURL, readGoogleReturn } from './googleSignIn'

const SITE = 'https://hearty-ram-74.eu-west-1.convex.site'
const BACK = 'https://hasio.net/partners'

describe('googleReturnURL', () => {
  it('lands back on the portal on this origin', () => {
    expect(googleReturnURL('https://hasio.net')).toBe('https://hasio.net/partners')
    expect(googleReturnURL('http://localhost:5173/')).toBe('http://localhost:5173/partners')
  })
})

describe('oauthStartURL', () => {
  it('opens /oauth-start for Google with both return addresses', () => {
    const url = new URL(oauthStartURL(SITE, BACK))
    expect(`${url.origin}${url.pathname}`).toBe(`${SITE}/api/auth/oauth-start`)
    expect(url.searchParams.get('provider')).toBe('google')
    expect(url.searchParams.get('callbackURL')).toBe(BACK)
    expect(url.searchParams.get('errorCallbackURL')).toBe(BACK)
  })

  it('tolerates a trailing slash on the site URL', () => {
    expect(oauthStartURL(`${SITE}/`, BACK).startsWith(`${SITE}/api/auth/`)).toBe(true)
  })

  it('refuses a missing site URL or return address', () => {
    expect(() => oauthStartURL('', BACK)).toThrow()
    expect(() => oauthStartURL(SITE, undefined)).toThrow()
    expect(() => oauthStartURL(SITE, '')).toThrow()
  })
})

describe('readGoogleReturn', () => {
  it('sees nothing on a normal visit', () => {
    expect(readGoogleReturn('')).toEqual({ kind: null, search: '' })
    expect(readGoogleReturn('?next=%2Fpartners%2Fhotel')).toEqual({ kind: null, search: '?next=%2Fpartners%2Fhotel' })
  })

  it('treats access_denied as a quiet cancel', () => {
    expect(readGoogleReturn('?error=access_denied')).toEqual({ kind: 'cancelled', search: '' })
  })

  it('treats any other code as a failure', () => {
    for (const code of ['state_mismatch', 'internal_server_error', 'please_restart_the_process', '']) {
      expect(readGoogleReturn(`?error=${code}`).kind).toBe('failed')
    }
  })

  it('removes error and error_description but keeps everything else', () => {
    expect(readGoogleReturn('?next=%2Fpartners%2Fverify&error=state_mismatch&error_description=x')).toEqual({
      kind: 'failed',
      search: '?next=%2Fpartners%2Fverify',
    })
  })
})
