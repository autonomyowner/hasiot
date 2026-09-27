import { afterEach, describe, expect, it, vi } from 'vitest'
import { convexQuery } from './convexHttp'

const URL = 'https://example.convex.cloud'

function stubFetch(respond) {
  const calls = []
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) })
    return respond()
  }))
  return calls
}

const json = (value, status = 200) => new Response(JSON.stringify(value), { status })

afterEach(() => vi.unstubAllGlobals())

describe('convexQuery', () => {
  it('posts the function path and arguments to the HTTP query API', async () => {
    const calls = stubFetch(() => json({ status: 'success', value: { ok: true } }))
    await expect(convexQuery('listings/queries:getListing', { listingId: 'l1' }, { url: URL })).resolves.toEqual({ ok: true })
    expect(calls[0].url).toBe(`${URL}/api/query`)
    expect(calls[0].init.method).toBe('POST')
    expect(calls[0].body).toEqual({ path: 'listings/queries:getListing', args: { listingId: 'l1' }, format: 'json' })
  })

  it('returns null and false values as they are', async () => {
    stubFetch(() => json({ status: 'success', value: null }))
    await expect(convexQuery('x:y', {}, { url: URL })).resolves.toBeNull()
  })

  it("carries a ConvexError's text on `data`, where the error helpers look for it", async () => {
    stubFetch(() => json({
      status: 'error',
      errorMessage: '[Request ID: 1] Server Error\nUncaught ConvexError: عربي / English',
      errorData: 'عربي / English',
    }))
    const err = await convexQuery('x:y', {}, { url: URL }).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err.data).toBe('عربي / English')
  })

  it('flags arguments Convex refused, so a page can say "not found" for a bad link', async () => {
    stubFetch(() => json({
      status: 'error',
      errorMessage: '[Request ID: 1] Server Error\nArgumentValidationError: Value does not match validator.\nPath: .listingId',
    }))
    const err = await convexQuery('x:y', { listingId: 'nope' }, { url: URL }).catch((e) => e)
    expect(err.validation).toBe(true)

    stubFetch(() => json({ status: 'error', errorMessage: 'Uncaught Error: boom', errorData: 'x / y' }))
    const other = await convexQuery('x:y', {}, { url: URL }).catch((e) => e)
    expect(other.validation).toBeUndefined()
  })

  it('reads the error body Convex sends with HTTP 560, as its own client does', async () => {
    // This deployment answers a failed function with 200; Convex's client also
    // expects 560 for one (convex/browser http_client, STATUS_CODE_UDF_FAILED).
    stubFetch(() => json({
      status: 'error',
      errorMessage: 'ArgumentValidationError: Value does not match validator.',
    }, 560))
    const err = await convexQuery('x:y', { listingId: 'nope' }, { url: URL }).catch((e) => e)
    expect(err.validation).toBe(true)

    stubFetch(() => json({ status: 'error', errorMessage: 'Uncaught ConvexError: x', errorData: 'عربي / English' }, 560))
    const refusal = await convexQuery('x:y', {}, { url: URL }).catch((e) => e)
    expect(refusal.data).toBe('عربي / English')
  })

  it('rejects on an HTTP failure, with no data to show a person', async () => {
    stubFetch(() => new Response('upstream', { status: 502 }))
    const err = await convexQuery('x:y', {}, { url: URL }).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err.data).toBeUndefined()
    expect(err.message).toContain('502')
  })

  it('rejects without a backend URL instead of fetching a relative path', async () => {
    const calls = stubFetch(() => json({ status: 'success', value: 1 }))
    await expect(convexQuery('x:y', {}, { url: '' })).rejects.toThrow(/VITE_CONVEX_URL/)
    expect(calls).toHaveLength(0)
  })
})
