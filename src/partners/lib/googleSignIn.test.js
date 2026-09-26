import { describe, expect, it } from 'vitest'
import { googleReturnURL, oauthStartURL, readGoogleReturn } from './googleSignIn'

const SITE = 'https://hearty-ram-74.eu-west-1.convex.site'
const GOOGLE = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=abc&state=x%2By&redirect_uri=https%3A%2F%2Fa.b%2Fcb'

describe('googleReturnURL', () => {
  it('lands back on the portal on this origin', () => {
    expect(googleReturnURL('https://hasio.net')).toBe('https://hasio.net/partners')
    expect(googleReturnURL('http://localhost:5173/')).toBe('http://localhost:5173/partners')
  })
})

describe('oauthStartURL', () => {
  it('points at /oauth-start with the Google URL encoded once', () => {
    const url = oauthStartURL(SITE, GOOGLE)
    expect(url.startsWith(`${SITE}/api/auth/oauth-start?authorizationURL=`)).toBe(true)
    expect(new URL(url).searchParams.get('authorizationURL')).toBe(GOOGLE)
  })

  it('tolerates a trailing slash on the site URL', () => {
    expect(oauthStartURL(`${SITE}/`, GOOGLE).startsWith(`${SITE}/api/auth/`)).toBe(true)
  })

  it('refuses a missing site URL or Google URL', () => {
    expect(() => oauthStartURL('', GOOGLE)).toThrow()
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
