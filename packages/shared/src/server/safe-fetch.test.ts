import { describe, expect, it } from 'vitest'
import {
  assertHttps,
  createSafeFetch,
  type FetchResponse,
  type FetchTransport,
  type Resolver,
  resolvePinnedIp,
  SsrfError,
} from './safe-fetch'

const resolverFrom =
  (map: Record<string, string[]>): Resolver =>
  async (host) =>
    map[host] ?? []

interface Canned {
  status?: number
  location?: string | null
  contentType?: string
  body?: Buffer
}
const transportFrom =
  (byUrl: Record<string, Canned>): FetchTransport =>
  async (url): Promise<FetchResponse> => {
    const c = byUrl[url.toString()] ?? byUrl['*'] ?? {}
    return {
      status: c.status ?? 200,
      location: c.location ?? null,
      contentType: c.contentType ?? 'image/png',
      readBody: async (maxBytes) => {
        const b = c.body ?? Buffer.from('ok')
        if (b.length > maxBytes) {
          throw new SsrfError('response exceeded max bytes')
        }
        return b
      },
      cancel: () => {},
    }
  }

describe('assertHttps', () => {
  it('rejects non-https', () => {
    expect(() => assertHttps(new URL('http://x.com'))).toThrow(SsrfError)
    expect(() => assertHttps(new URL('ftp://x.com'))).toThrow(SsrfError)
    expect(() => assertHttps(new URL('https://x.com'))).not.toThrow()
  })
})

describe('resolvePinnedIp', () => {
  const r = resolverFrom({
    'pub.example': ['8.8.8.8'],
    'evil.example': ['10.0.0.5'],
    'mixed.example': ['8.8.8.8', '127.0.0.1'],
  })

  it('accepts a public IP literal and resolves a public hostname', async () => {
    expect(await resolvePinnedIp('8.8.8.8', r)).toBe('8.8.8.8')
    expect(await resolvePinnedIp('pub.example', r)).toBe('8.8.8.8')
  })

  it('blocks IP-literal loopback/private', async () => {
    await expect(resolvePinnedIp('127.0.0.1', r)).rejects.toThrow(SsrfError)
    await expect(resolvePinnedIp('2130706433', r)).rejects.toThrow(SsrfError)
  })

  it('blocks a hostname that resolves to a private (or mixed) address', async () => {
    await expect(resolvePinnedIp('evil.example', r)).rejects.toThrow(SsrfError)
    await expect(resolvePinnedIp('mixed.example', r)).rejects.toThrow(SsrfError)
  })

  it('throws on no DNS records', async () => {
    await expect(resolvePinnedIp('nowhere.example', r)).rejects.toThrow(/no DNS records/)
  })
})

describe('createSafeFetch', () => {
  const resolver = resolverFrom({
    'good.example': ['8.8.8.8'],
    'evil.internal': ['10.0.0.5'],
    'loop.example': ['1.1.1.1'],
  })

  it('fetches a public https resource', async () => {
    const fetch = createSafeFetch({
      resolver,
      transport: transportFrom({ '*': { contentType: 'image/png', body: Buffer.from('PNG') } }),
    })
    const res = await fetch('https://good.example/cat.png')
    expect(res.contentType).toBe('image/png')
    expect(res.body.toString()).toBe('PNG')
  })

  it('rejects non-https and invalid URLs', async () => {
    const fetch = createSafeFetch({ resolver, transport: transportFrom({}) })
    await expect(fetch('http://good.example/')).rejects.toThrow(SsrfError)
    await expect(fetch('not a url')).rejects.toThrow(/invalid URL/)
  })

  it('re-validates redirects (a public URL cannot redirect to an internal host)', async () => {
    const fetch = createSafeFetch({
      resolver,
      transport: transportFrom({
        'https://good.example/': { status: 302, location: 'https://evil.internal/secret' },
      }),
    })
    await expect(fetch('https://good.example/')).rejects.toThrow(/blocked resolved address/)
  })

  it('caps redirects', async () => {
    const fetch = createSafeFetch({
      resolver,
      transport: transportFrom({ '*': { status: 302, location: 'https://good.example/next' } }),
    })
    await expect(fetch('https://good.example/', { maxRedirects: 2 })).rejects.toThrow(
      /too many redirects/,
    )
  })

  it('enforces the content-type allowlist', async () => {
    const fetch = createSafeFetch({
      resolver,
      transport: transportFrom({ '*': { contentType: 'text/html' } }),
    })
    await expect(
      fetch('https://good.example/', { allowedContentTypes: ['image/'] }),
    ).rejects.toThrow(/disallowed content-type/)
  })

  it('enforces the byte cap', async () => {
    const fetch = createSafeFetch({
      resolver,
      transport: transportFrom({ '*': { body: Buffer.alloc(100) } }),
    })
    await expect(fetch('https://good.example/', { maxBytes: 10 })).rejects.toThrow(/max bytes/)
  })

  it('rejects non-2xx statuses', async () => {
    const fetch = createSafeFetch({ resolver, transport: transportFrom({ '*': { status: 500 } }) })
    await expect(fetch('https://good.example/')).rejects.toThrow(/unexpected status 500/)
  })
})
